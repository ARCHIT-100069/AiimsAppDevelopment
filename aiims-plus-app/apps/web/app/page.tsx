import { redirect } from "next/navigation";
import { readSession } from "./lib/session";

/** Root: send authenticated users to the worklist, others to login. */
export default async function Home() {
  const session = await readSession();
  redirect(session ? "/patients" : "/login");
}
