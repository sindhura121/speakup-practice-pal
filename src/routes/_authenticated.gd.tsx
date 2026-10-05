import { createFileRoute } from "@tanstack/react-router";
import { GroupSetup } from "@/components/group-setup";

export const Route = createFileRoute("/_authenticated/gd")({
  head: () => ({ meta: [{ title: "Group Discussion — SpeakUp" }, { name: "description", content: "Join a realistic group discussion simulator." }] }),
  component: () => <GroupSetup kind="gd" />,
});
