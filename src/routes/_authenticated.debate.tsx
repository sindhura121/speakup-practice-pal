import { createFileRoute } from "@tanstack/react-router";
import { GroupSetup } from "@/components/group-setup";

export const Route = createFileRoute("/_authenticated/debate")({
  head: () => ({ meta: [{ title: "Debate — SpeakUp" }, { name: "description", content: "Debate AI opponents, friends or strangers." }] }),
  component: () => <GroupSetup kind="debate" />,
});
