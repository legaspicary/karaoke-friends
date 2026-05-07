import { RoomPageClient } from "./RoomPageClient";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <RoomPageClient roomCode={code.toUpperCase()} />;
}
