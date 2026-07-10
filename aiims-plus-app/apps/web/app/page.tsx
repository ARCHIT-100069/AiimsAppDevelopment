import { redirect } from "next/navigation";
import { readSession } from "./lib/session";
import { homeFor } from "./lib/roles";

/** Root: send each authenticated role to its console; others to login. */
export default async function Home() {
  const session = await readSession();
  redirect(session ? homeFor(session.roles) : "/login");
}
