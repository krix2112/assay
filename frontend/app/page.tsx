import { redirect } from "next/navigation";

/**
 * `/` temporarily redirects to `/dashboard`.
 * A landing page will replace this later.
 */
export default function RootPage() {
  redirect("/dashboard");
}
