import { ResultsWorkspace } from "@/components/results/results-workspace";

type ResultsPageProps = {
  params: Promise<{
    requestId: string;
  }>;
};

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { requestId } = await params;

  return <ResultsWorkspace requestId={requestId} />;
}
