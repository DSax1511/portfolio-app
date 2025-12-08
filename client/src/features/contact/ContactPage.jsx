import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";

const ContactPage = () => {
  return (
    <PageShell
      title="Contact"
      subtitle="Open to conversations on quantitative finance, product, or engineering roles."
    >
      <div className="about-container">
        <Card title="Contact details" subtitle="Reach out directly">
          <div className="simple-grid">
            <div>
              <p className="metric-label">Email</p>
              <a className="page-subtitle" href="mailto:Dfsaxton06@gmail.com">
                Dfsaxton06@gmail.com
              </a>
            </div>
            <div>
              <p className="metric-label">LinkedIn</p>
              <a
                className="page-subtitle"
                href="https://www.linkedin.com/in/davidsaxton06"
                target="_blank"
                rel="noreferrer"
              >
                linkedin.com/in/davidsaxton06
              </a>
            </div>
            <div>
              <p className="metric-label">Availability</p>
              <p className="muted">Available for consulting, product, or engineering collaborations.</p>
            </div>
          </div>
        </Card>

        <Card title="Let’s connect" subtitle="Schedule a note">
          <p className="muted">
            I’m happy to share more about Saxton PI, dive into the quant engine, or talk through your next project. 
            Send a note and I’ll respond within one business day.
          </p>
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <a className="btn btn-primary" href="mailto:Dfsaxton06@gmail.com?subject=SaxtonPI%20Contact">
              Email me
            </a>
            <a
              className="btn btn-ghost"
              href="https://www.linkedin.com/in/davidsaxton06"
              target="_blank"
              rel="noreferrer"
            >
              Message on LinkedIn
            </a>
          </div>
        </Card>
      </div>
    </PageShell>
  );
};

export default ContactPage;
