import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import HomeClient from "./home-client";

export default async function Page() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return <HomeClient />;
}
