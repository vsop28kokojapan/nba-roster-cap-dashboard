import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getNBAData } from '@/lib/data';
import TeamDetail from '@/components/TeamDetail';

interface Props {
  params: { abbr: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const data = await getNBAData();
    const team = data.teams.find(t => t.abbreviation === params.abbr.toUpperCase());
    return { title: team ? `${team.name} | NBA Cap Board` : 'NBA Cap Board' };
  } catch {
    return { title: 'NBA Cap Board' };
  }
}

export default async function TeamPage({ params }: Props) {
  const data = await getNBAData();
  const abbr = params.abbr.toUpperCase();
  const team = data.teams.find(t => t.abbreviation === abbr);
  if (!team) notFound();

  const players = data.players.filter(p => p.team === abbr);
  return <TeamDetail team={team} players={players} data={data} />;
}
