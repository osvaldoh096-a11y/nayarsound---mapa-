import { store } from '../config/store.js'

export default function Faq() {
  if (!store.faq?.length) return null
  return (
    <section className="faq" aria-labelledby="faq-title">
      <h2 id="faq-title" className="section-title">Preguntas</h2>
      {store.faq.map(({ q, a }) => (
        <details key={q} className="faq-item">
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
    </section>
  )
}
