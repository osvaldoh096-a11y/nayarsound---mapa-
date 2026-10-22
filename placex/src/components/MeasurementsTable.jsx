export default function MeasurementsTable({ measurements }) {
  if (!measurements?.rows?.length) return null
  const hasPending = measurements.rows.some((r) => r.values.some((v) => v == null || v === ''))
  return (
    <div className="measurements">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Talla</th>
              {measurements.columns.map((c) => (
                <th scope="col" key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {measurements.rows.map((row) => (
              <tr key={row.size}>
                <th scope="row">{row.size}</th>
                {row.values.map((v, i) => (
                  <td key={i} className={v == null || v === '' ? 'is-pending' : ''}>
                    {v == null || v === '' ? 'Por confirmar' : v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasPending && <p className="fine-print">Si tienes dudas sobre tu talla, pregúntanos por WhatsApp.</p>}
    </div>
  )
}
