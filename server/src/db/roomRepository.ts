import { supabase } from '../lib/supabase';

export async function createRoom(code: string, question: string, answers: string[]) {
  const { error } = await supabase.from('rooms').insert({ code, question, answers });
  if (error) throw error;
}

export async function updateRoomStatus(code: string, status: string, extra?: Record<string, unknown>) {
  const { error } = await supabase
    .from('rooms')
    .update({ status, ...extra })
    .eq('code', code);
  if (error) throw error;
}

export async function saveResult(params: {
  roomCode: string;
  winnerTeamIndex: number;
  winnerAnswer: string;
  teamPlayerCounts: Record<number, number>;
  totalTicks: number;
}) {
  const { data: room } = await supabase
    .from('rooms')
    .select('id')
    .eq('code', params.roomCode)
    .single();

  if (!room) return;

  await supabase.from('results').insert({
    room_id: room.id,
    winner_team_index: params.winnerTeamIndex,
    winner_answer: params.winnerAnswer,
    team_player_counts: params.teamPlayerCounts,
    total_ticks: params.totalTicks,
  });
}
