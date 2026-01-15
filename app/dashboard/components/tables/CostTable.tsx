"use client";

import type { ModelUsage } from "@/lib/types";

interface CostTableProps {
  data: ModelUsage[];
  title: string;
}

export function CostTable({ data, title }: CostTableProps) {
  return (
    <div className="glass-panel rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4 text-slate-100">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-slate-800/50">
            <tr>
              <th className="px-4 py-3 text-slate-300">模型</th>
              <th className="px-4 py-3 text-slate-300 text-right">请求数</th>
              <th className="px-4 py-3 text-slate-300 text-right">Token 总数</th>
              <th className="px-4 py-3 text-slate-300 text-right">输入 Token</th>
              <th className="px-4 py-3 text-slate-300 text-right">输出 Token</th>
              <th className="px-4 py-3 text-slate-300 text-right">费用</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={item.model} className={index % 2 === 0 ? "bg-slate-800/20" : "bg-slate-800/10"}>
                <td className="px-4 py-3 font-medium text-slate-200">{item.model}</td>
                <td className="px-4 py-3 text-right text-slate-300 tabular-nums">{item.requests.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-slate-300 tabular-nums">{item.tokens.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-slate-300 tabular-nums">{item.inputTokens.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-slate-300 tabular-nums">{item.outputTokens.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-400 tabular-nums">
                  ${item.cost.toFixed(4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
