// Content for /terms. Same disclaimer as privacy.ts: AI-drafted starting
// point, not legal advice -- have it reviewed by a lawyer before treating
// it as final.
import type { LegalDoc } from "./privacy";

const CONTACT_EMAIL = "enterprise@openvoiss.com";
const CONTACT_PHONE = "+56 9 4095 6827";

export const terms: { es: LegalDoc; en: LegalDoc } = {
  es: {
    updated: "31 de agosto de 2026",
    notice:
      "Este documento es un borrador redactado como punto de partida y no constituye asesoría legal. Recomendamos revisión de un abogado antes de considerarlo definitivo.",
    sections: [
      {
        heading: "1. Aceptación",
        paragraphs: [
          "Al registrarte o usar Voysse Cloud, aceptas estos Términos de Servicio. Si no estás de acuerdo, no debes usar el servicio.",
        ],
      },
      {
        heading: "2. Qué es Voysse",
        paragraphs: [
          "Voysse es una plataforma para que agencias creen y gestionen agentes de IA para sus clientes. Hay dos formas de usarla: auto-hospedada (self-hosted), bajo la licencia FSL-1.1-MIT del código fuente -- en ese caso rige esa licencia, no estos Términos --, y Voysse Cloud, el servicio que nosotros operamos y hosteamos, al que sí aplican estos Términos.",
        ],
      },
      {
        heading: "3. Registro y activación de tu cuenta",
        paragraphs: [
          "Al registrarte, tu cuenta queda pendiente de activación. Un miembro de nuestro equipo la revisa antes de habilitar el acceso -- es un paso manual, no automático, y puede tomar cierto tiempo.",
          "Eres responsable de mantener la confidencialidad de tu contraseña y de toda actividad que ocurra bajo tu cuenta.",
        ],
      },
      {
        heading: "4. Tu responsabilidad como agencia",
        paragraphs: [
          "Eres responsable de la información que cargas sobre tus clientes y de las conversaciones que tus agentes sostienen con los usuarios finales de esos clientes.",
          "Frente a los usuarios finales de tus clientes, tú actúas como responsable del tratamiento de esos datos; Voysse actúa como encargado del tratamiento, alojando la infraestructura que tú usas.",
        ],
      },
      {
        heading: "5. Claves de proveedores de IA (BYOK)",
        paragraphs: [
          "Voysse funciona con tus propias claves de OpenAI o Anthropic (\"bring your own key\"). Eres responsable de mantener tu cuenta con esos proveedores vigente y de pagar sus cargos por separado -- Voysse no cobra por el uso del modelo de IA.",
          "No somos responsables por el contenido que el modelo de IA genere: es una herramienta que tú configuras, y su salida depende del proveedor y del modelo que elijas, no de nosotros.",
        ],
      },
      {
        heading: "6. Planes y pago",
        paragraphs: [
          "Actualmente, la suscripción a Voysse Cloud se coordina de forma manual, directamente contigo, fuera de la plataforma. No hay cobro automático dentro del producto.",
          "El precio, la forma de pago y las condiciones específicas se acuerdan directamente al momento de activar tu cuenta de Cloud.",
        ],
      },
      {
        heading: "7. Uso aceptable",
        paragraphs: [
          "No puedes usar Voysse para enviar spam o comunicaciones masivas no solicitadas, distribuir contenido ilegal, realizar actividades fraudulentas, ni para ningún uso que viole la ley chilena aplicable o los términos de los proveedores de IA o de WhatsApp que conectes.",
        ],
      },
      {
        heading: "8. Suspensión y término",
        paragraphs: [
          "Podemos suspender o desactivar tu cuenta si incumples estos Términos, por uso indebido, o por falta de pago acordado. Tú puedes dejar de usar el servicio cuando quieras.",
        ],
      },
      {
        heading: "9. Propiedad intelectual",
        paragraphs: [
          "El código fuente de Voysse está disponible bajo la licencia FSL-1.1-MIT. La marca \"Voysse\", su logo y el servicio hosteado \"Voysse Cloud\" no están incluidos en esa licencia y son de nuestra propiedad.",
        ],
      },
      {
        heading: "10. Garantías y limitación de responsabilidad",
        paragraphs: [
          "El servicio se entrega \"tal cual\", sin garantía de disponibilidad ininterrumpida. En la máxima medida permitida por la ley, Voysse no será responsable por daños indirectos, lucro cesante o pérdida de datos, más allá de lo efectivamente pagado por el servicio en los últimos tres meses.",
        ],
      },
      {
        heading: "11. Ley aplicable",
        paragraphs: [
          "Estos Términos se rigen por las leyes de la República de Chile. Cualquier controversia se someterá a los tribunales competentes de Chile.",
        ],
      },
      {
        heading: "12. Cambios a estos términos",
        paragraphs: [
          "Podemos actualizar estos Términos. Los cambios significativos se notificarán con antelación razonable.",
        ],
      },
      {
        heading: "13. Contacto",
        paragraphs: [`${CONTACT_EMAIL} · ${CONTACT_PHONE}`],
      },
    ],
  },
  en: {
    updated: "August 31, 2026",
    notice:
      "This document is an AI-drafted starting point, not legal advice -- have it reviewed by a lawyer before treating it as final. In case of any conflict between this English version and the Spanish version, the Spanish version governs.",
    sections: [
      {
        heading: "1. Acceptance",
        paragraphs: [
          "By registering or using Voysse Cloud, you accept these Terms of Service. If you don't agree, you shouldn't use the service.",
        ],
      },
      {
        heading: "2. What Voysse is",
        paragraphs: [
          "Voysse is a platform for agencies to build and manage AI agents for their clients. There are two ways to use it: self-hosted, under the source code's FSL-1.1-MIT license -- in that case that license governs, not these Terms --, and Voysse Cloud, the service we operate and host, which these Terms do apply to.",
        ],
      },
      {
        heading: "3. Registration and account activation",
        paragraphs: [
          "When you register, your account is pending activation. A member of our team reviews it before enabling access -- this is a manual step, not automatic, and can take some time.",
          "You're responsible for keeping your password confidential and for any activity that happens under your account.",
        ],
      },
      {
        heading: "4. Your responsibility as an agency",
        paragraphs: [
          "You're responsible for the information you enter about your clients and for the conversations your agents hold with those clients' end users.",
          "Toward your clients' end users, you act as the data controller for that data; Voysse acts as a data processor, hosting the infrastructure you use.",
        ],
      },
      {
        heading: "5. Third-party AI provider keys (BYOK)",
        paragraphs: [
          "Voysse runs on your own OpenAI or Anthropic keys (\"bring your own key\"). You're responsible for keeping your account with those providers in good standing and for paying their charges separately -- Voysse doesn't charge for AI model usage.",
          "We're not responsible for content generated by the AI model: it's a tool you configure, and its output depends on the provider and model you choose, not on us.",
        ],
      },
      {
        heading: "6. Plans and payment",
        paragraphs: [
          "Right now, Voysse Cloud subscriptions are arranged manually, directly with you, outside the platform. There's no automatic billing inside the product.",
          "Price, payment method and specific terms are agreed directly when your Cloud account is activated.",
        ],
      },
      {
        heading: "7. Acceptable use",
        paragraphs: [
          "You may not use Voysse to send spam or unsolicited bulk communications, distribute illegal content, engage in fraud, or for any use that violates applicable Chilean law or the terms of the AI or WhatsApp providers you connect.",
        ],
      },
      {
        heading: "8. Suspension and termination",
        paragraphs: [
          "We may suspend or deactivate your account if you breach these Terms, misuse the service, or fail to pay as agreed. You can stop using the service whenever you want.",
        ],
      },
      {
        heading: "9. Intellectual property",
        paragraphs: [
          "Voysse's source code is available under the FSL-1.1-MIT license. The \"Voysse\" brand, its logo, and the hosted \"Voysse Cloud\" service are not included in that license and remain our property.",
        ],
      },
      {
        heading: "10. Warranties and limitation of liability",
        paragraphs: [
          "The service is provided \"as is\", with no guarantee of uninterrupted availability. To the maximum extent permitted by law, Voysse won't be liable for indirect damages, lost profits, or data loss beyond what you actually paid for the service in the prior three months.",
        ],
      },
      {
        heading: "11. Governing law",
        paragraphs: [
          "These Terms are governed by the laws of the Republic of Chile. Any dispute will be submitted to the competent courts of Chile.",
        ],
      },
      {
        heading: "12. Changes to these terms",
        paragraphs: [
          "We may update these Terms. Significant changes will be notified with reasonable advance notice.",
        ],
      },
      {
        heading: "13. Contact",
        paragraphs: [`${CONTACT_EMAIL} · ${CONTACT_PHONE}`],
      },
    ],
  },
};
