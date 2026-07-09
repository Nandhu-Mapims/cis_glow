# Prisma / Node.js compatibility

## Current setup (recommended)

| Tool | Version | Node required |
|------|---------|---------------|
| **Prisma 6** (this project) | `6.19.3` | Node **18.18+** |
| Prisma 7 | `7.x` | Node **20.19+**, **22.12+**, or **24+** |

This server uses **Prisma 6.19.3**, which works on your current Node **v18.19.1**.

## Do not run

```bash
npm install -g prisma@7
npx prisma@7.8.0 db pull
```

Those commands target Prisma 7 and will show `EBADENGINE` warnings (or fail) on Node 18.

## Use project-local Prisma instead

From the `server/` folder:

```bash
cd /home/mapims/cis/legacy-cis-modernized/server
npm install
npm run db:pull      # uses prisma 6.19.3 from node_modules
npm run db:generate
npm run dev
```

Or explicitly:

```bash
npx prisma@6.19.3 db pull
npx prisma@6.19.3 generate
```

## After you upgrade Node

Target **Node 20.19+** (or 22.12+ / 24+). Then from `server/`:

```bash
node -v                    # confirm v20.19.0 or higher
npm install
npm run db:generate
npm run dev
```

Prisma **6.19.3** (current) works fine on Node 20. To move to Prisma 7:

```bash
npm install prisma@7 @prisma/client@7 --save-dev --save
npm run db:generate
```

Until Node is upgraded, stay on Node 18 + Prisma 6 — do not install `prisma@7` globally.
