import {Reveal} from "../motion";

/** intro-editorial (aside "Introducing" band): a small eyebrow link on the left, two
 *  body paragraphs on the right — the problem, then Verity's answer. White canvas, airy. */
export function Intro(){
  return (
    <section className="web-section web-section--white" id="intro">
      <div className="web-wrap web-intro">
        <Reveal className="web-intro__eyebrow">
          <span className="web-eyebrow">Introducing Verity</span>
        </Reveal>
        <div className="web-intro__body">
          <Reveal as="p" className="vy-heading-lg web-intro__lead" delay={60}>
            Live debates move faster than anyone can check. A confident claim lands, the
            conversation rolls on, and the correction — if it ever comes — arrives long
            after the moment has passed.
          </Reveal>
          <Reveal as="p" className="vy-body-lg web-intro__para" delay={140}>
            Verity checks the conversation while it is still happening. It listens to a
            two-speaker YouTube discussion, separates checkable facts from rhetoric, and
            weighs credible evidence and counterevidence against the exact claim — then
            hands back a cited verdict, in the overlay and on your phone, before the
            argument has moved on.
          </Reveal>
        </div>
      </div>
    </section>
  );
}
