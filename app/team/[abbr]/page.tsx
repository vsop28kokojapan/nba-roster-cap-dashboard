import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getNBAData } from '@/lib/data';
import TeamDetail from '@/components/TeamDetail';

interface Props {
  params: { abbr: string };
}

const BASE_URL = 'https://nba-roster-cap-dashboard.vercel.app';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const data = await getNBAData();
    const abbr = params.abbr.toUpperCase();
    const team = data.teams.find(t => t.abbreviation === abbr);
    if (!team) return { title: 'NBA Cap Board' };

    const playerCount = data.players.filter(p => p.team === abbr).length;
    const title = `${team.name} ロスター・年俸 2024-25`;
    const description = `${team.name}の選手一覧・サラリーキャップ情報。選手${playerCount}名のロスター、契約年数、キャップ状況（${team.apronStatus}）を日本語で確認。`;
    const url = `${BASE_URL}/team/${abbr}`;

    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        title,
        description,
        url,
        type: 'website',
        locale: 'ja_JP',
        siteName: 'NBA Cap Board',
      },
      twitter: { card: 'summary', title, description },
    };
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
