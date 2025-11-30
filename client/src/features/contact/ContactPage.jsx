import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";
import SectionHeader from "../../components/layout/SectionHeader";

const ContactPage = () => {
  return (
    <PageShell
      title="Contact Me"
      subtitle="I’m an entry-level cybersecurity-focused computer science student with experience in vulnerability management, quantitative modeling, and building fintech tools. Feel free to reach out."
    >
      <div className="about-container">
        <SectionHeader
          overline="Portfolio Intelligence"
          title="Contact"
          subtitle="Reach out for opportunities across quantitative finance, cybersecurity, or software engineering."
        />
        <Card title="Contact Details" subtitle="Reach out directly">
          <div className="simple-grid">
            <div>
              <p className="metric-label">Name</p>
              <p className="page-subtitle">David Saxton</p>
            </div>
            <div>
              <p className="metric-label">Phone</p>
              <a className="page-subtitle" href="tel:+13392260947">(339) 226-0947</a>
            </div>
            <div>
              <p className="metric-label">Email</p>
              <a className="page-subtitle" href="mailto:Dfsaxton06@gmail.com">Dfsaxton06@gmail.com</a>
            </div>
            <div>
              <p className="metric-label">LinkedIn</p>
              <a
                className="page-subtitle"
                href="https://www.linkedin.com/in/davidsaxton06"
                target="_blank"
                rel="noreferrer"
              >
                www.linkedin.com/in/davidsaxton06
              </a>
            </div>
          </div>
        </Card>

        <Card title="Quick message" subtitle="Opportunities welcome">
          <p className="muted">
            You can also reach me via email for opportunities related to quantitative finance, cybersecurity, or software engineering.
          </p>
          <button
            className="btn btn-primary"
            onClick={() =>
              window.location.href = "mailto:Dfsaxton06@gmail.com?subject=Portfolio%20App%20Contact"
            }
          >
            Email Me
          </button>
        </Card>
      </div>
    </PageShell>
  );
};

export default ContactPage;
