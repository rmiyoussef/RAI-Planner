export function EmailTemplatePreview({ html, mock = false, title = 'Preview' }: { html: string; mock?: boolean; title?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        {mock && (
          <span className="badge badge-muted text-[11px]">Mock data — never executes PHP</span>
        )}
      </div>
      <iframe
        title={title}
        sandbox=""
        srcDoc={html}
        className="h-[420px] w-full rounded-xl border border-border bg-white"
      />
    </div>
  )
}
