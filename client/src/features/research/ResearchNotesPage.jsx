import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";

const ResearchNotesPage = () => {
  return (
    <PageShell
      title="Research Notes"
      subtitle="Lightweight space for jotting observations, TODOs, and follow-ups."
    >
      <Card title="Notes workspace" subtitle="Coming soon">
        <p className="muted">
          Organize notes by strategy, regime, or experiment to keep a paper trail of hypotheses, results, and next steps.
        </p>
      </Card>
    </PageShell>
  );
};

export default ResearchNotesPage;
