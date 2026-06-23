import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getNBAData } from '@/lib/data';
import TeamDetail from '@/components/TeamDetail';

interface Props {
  params: { abbr: string };
}

export function generateStaticParams() {
  const data = getNBAData();
  return data.teams.map(t => ({ abbr: t.abbreviation }));
}

export function generateMetadata({ params }: Props): Metadata {
  const data = getNBAData();
  const team = data.teams.find(t => t.abbreviation === params.abbr.toUpperCase());
  return { title: team ? `${team.name} | NBA Cap Board` : 'NBA Cap Board' };
}

export default function TeamPage({ params }: Props) {
  const data = getNBAData();
  const abbr = params.abbr.toUpperCase();
  const team = data.teams.find(t => t.abbreviation === abbr);
  if (!team) notFound();

  const players = data.players.filter(p => p.team === abbr);
  return <TeamDetail team={team} players={players} data={data} />;
}
