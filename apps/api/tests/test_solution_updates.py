"""Pure tests: runnable with unittest without loading the DB pytest fixtures."""
import itertools
import unittest

from pydantic import ValidationError

from app.services.solution_updates import SolutionSettings, plan_update


def settings(**changes):
    return SolutionSettings(**{
        "instructions": "Answer approved questions and offer human handoff.",
        "personality": "Clear and friendly",
        "temperature": 0.7,
        "max_tokens": 2048,
        "memory_limit": 30,
        **changes,
    })


class SolutionUpdateTests(unittest.TestCase):
    def test_noop(self):
        baseline = settings()
        plan = plan_update(baseline, baseline, baseline)
        self.assertEqual(plan.configuration, baseline)
        self.assertEqual(plan.conflicts, ())
        self.assertEqual(plan.local_overrides, frozenset())
        self.assertTrue(all(change.status == "unchanged" for change in plan.changes))

    def test_shared_update_preserves_unrelated_local_change(self):
        current = settings(personality="Formal")
        target = settings(max_tokens=1024)
        plan = plan_update(settings(), current, target)
        self.assertEqual(plan.configuration, settings(personality="Formal", max_tokens=1024))
        self.assertEqual(plan.local_overrides, frozenset({"personality"}))
        self.assertEqual(current.max_tokens, 2048)
        self.assertEqual(target.personality, settings().personality)

    def test_conflict_blocks_whole_configuration(self):
        plan = plan_update(settings(), settings(personality="Formal"),
                           settings(personality="Casual", max_tokens=512))
        self.assertEqual(plan.conflicts, ("personality",))
        self.assertIsNone(plan.configuration)
        self.assertEqual(next(c.status for c in plan.changes if c.field == "max_tokens"), "updated")

    def test_equal_valued_override_is_not_silently_overwritten(self):
        plan = plan_update(settings(), settings(), settings(memory_limit=10),
                           local_overrides=frozenset({"memory_limit"}))
        self.assertEqual(plan.conflicts, ("memory_limit",))
        self.assertIsNone(plan.configuration)

    def test_converged_local_change_keeps_override_provenance(self):
        target = settings(personality="Formal")
        plan = plan_update(settings(), target, target)
        self.assertEqual(plan.configuration, target)
        self.assertEqual(plan.local_overrides, frozenset({"personality"}))
        following = plan_update(target, plan.configuration, settings(personality="Casual"),
                                local_overrides=plan.local_overrides)
        self.assertEqual(following.conflicts, ("personality",))

    def test_rollback_preserves_local_edits(self):
        installed = settings(max_tokens=1024)
        current = settings(max_tokens=1024, personality="Formal")
        plan = plan_update(installed, current, settings())
        self.assertEqual(plan.configuration, settings(personality="Formal"))
        self.assertEqual(plan.local_overrides, frozenset({"personality"}))

    def test_rollback_conflict_does_not_erase_local_change(self):
        plan = plan_update(settings(max_tokens=1024), settings(max_tokens=512), settings())
        self.assertEqual(plan.conflicts, ("max_tokens",))
        self.assertIsNone(plan.configuration)

    def test_multiple_clients_are_independent(self):
        baseline, target = settings(), settings(personality="Casual")
        first = plan_update(baseline, baseline, target)
        second = plan_update(baseline, settings(personality="Formal"), target)
        self.assertEqual(first.configuration, target)
        self.assertEqual(second.conflicts, ("personality",))
        self.assertEqual(baseline, settings())

    def test_unknown_override_rejected(self):
        with self.assertRaises(ValueError):
            plan_update(settings(), settings(), settings(), local_overrides=frozenset({"api_key"}))

    def test_override_input_is_copied(self):
        overrides = {"memory_limit"}
        plan = plan_update(settings(), settings(), settings(), local_overrides=overrides)
        overrides.clear()
        self.assertEqual(plan.local_overrides, frozenset({"memory_limit"}))

    def test_configuration_and_plan_are_immutable(self):
        plan = plan_update(settings(), settings(), settings())
        with self.assertRaises(ValidationError):
            plan.configuration.max_tokens = 3
        with self.assertRaises(AttributeError):
            plan.configuration = None
        with self.assertRaises(AttributeError):
            plan.changes[0].status = "updated"

    def test_repeated_preview_after_apply_is_idempotent(self):
        target = settings(max_tokens=1024)
        first = plan_update(settings(), settings(personality="Formal"), target)
        repeated = plan_update(target, first.configuration, target,
                               local_overrides=first.local_overrides)
        self.assertEqual(repeated.configuration, first.configuration)
        self.assertEqual(repeated.local_overrides, first.local_overrides)
        self.assertFalse(any(change.status == "updated" for change in repeated.changes))

    def test_three_way_matrix(self):
        # Exhaust every relationship, including empty strings and explicit intent.
        for old, local, target, explicit in itertools.product(("", "A", "B"), ("", "A", "B"),
                                                             ("", "A", "B"), (False, True)):
            with self.subTest(old=old, local=local, target=target, explicit=explicit):
                overrides = frozenset({"instructions"}) if explicit else frozenset()
                plan = plan_update(settings(instructions=old), settings(instructions=local),
                                   settings(instructions=target), local_overrides=overrides)
                edited = bool(explicit) or local != old
                conflict = edited and target != old and target != local
                self.assertEqual(plan.configuration is None, conflict)
                if not conflict:
                    self.assertEqual(plan.configuration.instructions, local if edited else target)
                self.assertEqual("instructions" in plan.local_overrides, edited)


class SolutionSettingsTests(unittest.TestCase):
    def test_rejects_private_fields_and_activation(self):
        for field in ("agency_id", "client_id", "name", "manual_context", "documents",
                      "api_key", "tools", "provider", "model", "timezone", "widget_enabled",
                      "is_active", "brief_products", "channel_id", "conversation_history"):
            with self.subTest(field=field), self.assertRaises(ValidationError):
                settings(**{field: "private"})

    def test_requires_complete_snapshot(self):
        for field in SolutionSettings.model_fields:
            payload = settings().model_dump()
            payload.pop(field)
            with self.subTest(field=field), self.assertRaises(ValidationError):
                SolutionSettings.model_validate(payload)

    def test_rejects_nulls_coercion_ranges_and_unbounded_text(self):
        cases = [(field, None) for field in SolutionSettings.model_fields]
        cases += [("temperature", value) for value in (-1, 3, float("nan"), float("inf"), True, "0.7")]
        cases += [("max_tokens", value) for value in (0, 32001, True, 1.5, "2048")]
        cases += [("memory_limit", value) for value in (-1, 201, True)]
        cases += [("instructions", "x" * 32001), ("personality", "x" * 8001)]
        for field, value in cases:
            with self.subTest(field=field), self.assertRaises(ValidationError):
                settings(**{field: value})

    def test_accepts_boundary_values(self):
        self.assertEqual(settings(temperature=0.0, max_tokens=1, memory_limit=0).memory_limit, 0)
        self.assertEqual(settings(temperature=2.0, max_tokens=32000, memory_limit=200).max_tokens, 32000)

    def test_revalidates_copied_instances_at_planning_boundary(self):
        invalid = settings().model_copy(update={"temperature": float("nan")})
        for snapshots in ((invalid, settings(), settings()), (settings(), invalid, settings()),
                          (settings(), settings(), invalid)):
            with self.subTest(), self.assertRaises(ValidationError):
                plan_update(*snapshots)


if __name__ == "__main__":
    unittest.main()
