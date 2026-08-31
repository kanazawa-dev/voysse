import { defineRailway, project, service, postgres, github } from "railway/iac";

// Voysse — full stack on Railway, deployed from GitHub (kanazawa-dev/openvoiss).
//
// Secrets (SECRET_KEY, ENCRYPTION_KEY, WHATSAPP_BRIDGE_TOKEN, DATABASE_URL)
// and the cross-origin URLs that depend on generated public domains
// (FRONTEND_URL, NEXT_PUBLIC_API_URL, NEXT_PUBLIC_APP_URL) are NOT declared
// here — they're set imperatively via `railway variable set` after the
// services exist and their public domains are generated, so secrets never
// land in git. This file only shapes the infrastructure: which services
// exist, where their code comes from, and how the api/whatsapp bridge pair
// reach each other over Railway's private network.
export default defineRailway(() => {
  const db = postgres("db");

  const whatsapp = service("whatsapp", {
    source: github("kanazawa-dev/openvoiss", {
      branch: "main",
      rootDirectory: "apps/whatsapp",
    }),
    env: {
      NODE_ENV: "production",
    },
  });

  const api = service("api", {
    source: github("kanazawa-dev/openvoiss", {
      branch: "main",
      rootDirectory: "apps/api",
    }),
    env: {
      NODE_ENV: "production",
      COOKIE_SECURE: "true",
      // web and api live on different Railway domains, so cookies need
      // SameSite=None to survive the cross-site request.
      COOKIE_SAMESITE: "none",
      WHATSAPP_BRIDGE_URL: `http://${whatsapp.env.RAILWAY_PRIVATE_DOMAIN}:3101`,
    },
  });

  whatsapp.env.BACKEND_URL = `http://${api.env.RAILWAY_PRIVATE_DOMAIN}:8000`;

  const web = service("web", {
    source: github("kanazawa-dev/openvoiss", {
      branch: "main",
      rootDirectory: "apps/web",
    }),
    env: {
      NODE_ENV: "production",
    },
  });

  const marketing = service("marketing", {
    source: github("kanazawa-dev/openvoiss", {
      branch: "main",
      rootDirectory: "apps/marketing",
    }),
    env: {
      NODE_ENV: "production",
    },
  });

  const docs = service("docs", {
    source: github("kanazawa-dev/openvoiss", {
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
