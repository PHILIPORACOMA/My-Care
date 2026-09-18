import { ScreenHeader } from "../../components/ScreenHeader.js";

/** Shared layout for the Settings screen's "About My Care" and "Help & documentation" rows. */
export function InfoScreen(props: { title: string; body: string; onBack: () => void }) {
  return (
    <section className="screen">
      <ScreenHeader onBack={props.onBack} title={props.title} />
      <p>{props.body}</p>
    </section>
  );
}
