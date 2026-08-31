import { defineRailway, project, service, postgres, github, preserve } from "railway/iac";

// Voysse — full stack on Railway, deployed from GitHub (kanazawa-dev/voysse).
//
// Secrets (SECRET_KEY, ENCRYPTION_KEY, WHATSAPP_BRIDGE_TOKEN, DATABASE_URL)
// and the cross-origin URLs that depend on generated public domains
// (FRONTEND_URL, NEXT_PUBLIC_API_URL, NEXT_PUBLIC_APP_URL, WHATSAPP_BRIDGE_URL,
// BACKEND_URL) were set imperatively via `railway variable set` after the
// services existed and their public/private domains were known, so their
// values never landed in git. They're declared here as preserve() so a
// future `railway config apply` leaves them alone instead of deleting them
// to match a file that never had their values in the first place.
export default defineRailway(() => {
  const db = postgres("db");

  const whatsapp = service("whatsapp", {
    source: github("kanazawa-dev/voysse", {
      branch: "main",
      rootDirectory: "apps/whatsapp",
    }),
    env: {
      NODE_ENV: "production",
      BACKEND_URL: preserve(),
      WHATSAPP_BRIDGE_TOKEN: preserve(),
    },
  });

  const api = service("api", {
    source: github("kanazawa-dev/voysse", {
      branch: "main",
      rootDirectory: "apps/api",
    }),
    env: {
      NODE_ENV: "production",
      COOKIE_SECURE: "true",
      // web and api live on different Railway domains, so cookies need
      // SameSite=None to survive the cross-site request.
      COOKIE_SAMESITE: "none",
      WHATSAPP_BRIDGE_URL: preserve(),
      DATABASE_URL: preserve(),
      SECRET_KEY: preserve(),
      ENCRYPTION_KEY: preserve(),
      WHATSAPP_BRIDGE_TOKEN: preserve(),
      FRONTEND_URL: preserve(),
    },
  });

  const web = service("web", {
    source: github("kanazawa-dev/voysse", {
      branch: "main",
      rootDirectory: "apps/web",
    }),
    env: {
      NODE_ENV: "production",
      NEXT_PUBLIC_API_URL: preserve(),
    },
  });

  const marketing = service("marketing", {
    source: github("kanazawa-dev/voysse", {
      branch: "main",
      rootDirectory: "apps/marketing",
    }),
    env: {
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: preserve(),
    },
  });

  const docs = service("docs", {
    source: github("kanazawa-dev/voysse", {
      branch: "main",
      rootDirectory: "apps/docs",
    }),
    env: {
      NODE_ENV: "production",
    },
  });

  return project("voysse", {
    resources: [db, api, web, whatsapp, marketing, docs],
  });
});
