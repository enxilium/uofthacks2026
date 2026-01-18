This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

We will run a server process in the background along with the web app. This server is what Fluxor is.
- Periodically, calls a function `check_for_anomalies`, which prompts your agent to look at the database and analyze it for potential problems, and action items that we can do.
- ENSURE your agent outputs a structured response schema.
- For each action item (can be 0 if no anomalies detected), call a function `begin_experiment(change)`. `change` is the action item proposed by your agent. This function will do 2 things:
1. Call opencode (local agent) which will modify the servers' files. I WILL DO THIS PART
2. Set up a scheduler that will call a function `check_experiment_results(experiment)` and store the current time as the experiment start time. This means we need to maintain a list of active experiments. In a production environment, this would be after 24 hours or something to let data gather. However, for demo purposes, we will check it after one new entry to the DB are found from a new user id. The checkout website should have a button that creates a random user session ID to simulate a different user. be sure to mention everything here during demo.
- If experiment success: nothing needs to be done. We implemented a great change.
- If experiment actually showed more rage than before (i.e. the new user had just as much or even more trouble), call `revert_experiment(change)`. This will call my opencode agent with a prompt to basically revert the change.
In demo, we should show both these scenarios.

The idea is that this is an entirely automated, constnatly improving checkout experience based on real user data, that can make real code changes to the codebase, revert them - the entire pipeline.

Talk about further extensions: human-in-the-loop for observability, think of some stuff urself too
