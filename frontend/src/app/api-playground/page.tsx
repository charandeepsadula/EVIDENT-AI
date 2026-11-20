import { redirect } from "next/navigation";

export default function ApiPlaygroundRedirect() {
  redirect("/system-health");
}
