import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// The model replies in markdown — headings, bold, bullets, the occasional table.
// Rendering it as preformatted text is what made answers read as raw model output.
const components = {
  p: ({ children }) => <p className="mb-3 last:mb-0 leading-[1.7]">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-semibold text-parchment-50">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
  // The marker belongs to the list, not the item — react-markdown gives `li` no
  // reliable handle on its parent, and guessing produced "1. •" double markers.
  ul: ({ children }) => (
    <ul className="mb-3 last:mb-0 space-y-1.5 pl-1 [&>li]:relative [&>li]:pl-5 [&>li]:before:absolute [&>li]:before:left-1 [&>li]:before:top-[0.7em] [&>li]:before:h-1 [&>li]:before:w-1 [&>li]:before:rounded-full [&>li]:before:bg-moss-500">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 last:mb-0 space-y-1.5 pl-5 list-decimal marker:text-slate-500">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-[1.7]">{children}</li>,
  h1: ({ children }) => (
    <h3 className="font-display text-lg text-parchment-50 mt-5 mb-2 first:mt-0">
      {children}
    </h3>
  ),
  h2: ({ children }) => (
    <h3 className="font-display text-base text-parchment-50 mt-5 mb-2 first:mt-0">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="font-semibold text-sm uppercase tracking-wide text-slate-300 mt-5 mb-2 first:mt-0">
      {children}
    </h4>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-moss-600 pl-4 my-3 text-slate-300 italic">
      {children}
    </blockquote>
  ),
  // react-markdown v9 dropped the `inline` prop, so every `code` was falling into
  // the block branch — inline citations rendered as full-width boxes. The block
  // case now comes from `pre`, which strips the inline pill styling off its child.
  pre: ({ children }) => (
    <pre className="font-mono text-xs bg-ink-950 border border-ink-700 rounded-lg p-3 my-3 overflow-x-auto [&>code]:bg-transparent [&>code]:border-0 [&>code]:p-0 [&>code]:text-[inherit]">
      {children}
    </pre>
  ),
  code: ({ children }) => (
    <code className="font-mono text-[0.85em] bg-ink-950 border border-ink-700 rounded px-1.5 py-0.5 text-parchment-100">
      {children}
    </code>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-moss-500 underline underline-offset-2 hover:text-moss-400"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-4 border-ink-700" />,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="text-left font-semibold text-slate-300 border-b border-ink-700 px-3 py-2">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-ink-800 px-3 py-2 align-top">{children}</td>
  ),
};

export default function Markdown({ children }) {
  return (
    <div className="text-[15px] text-parchment-100">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
