import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";

const ResearchHomePage = () => {
  return (
    <PageShell
      title="Research Hub"
      subtitle="Centralize write-ups, PDFs, and working notes alongside live analytics."
    >
      <Card title="Research library" subtitle="Placeholder">
        <p className="muted">
          Use this space for strategy papers, investment memos, and supporting research artifacts to keep context next to the tools.
        </p>
      </Card>
    </PageShell>
  );
};

export default ResearchHomePage;
