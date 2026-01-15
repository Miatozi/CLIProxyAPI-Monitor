"use client";

import { useState, useEffect, type FormEvent } from "react";
import { Save, Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/app/components/Modal";
import { ComboBox } from "@/app/dashboard/components/ui/ComboBox";
import { useTheme } from "@/app/components/ThemeProvider";

interface ModelPrice {
  model: string;
  inputPricePer1M: number;
  cachedInputPricePer1M: number;
  outputPricePer1M: number;
}

interface PriceForm {
  model: string;
  inputPricePer1M: string;
  cachedInputPricePer1M: string;
  outputPricePer1M: string;
}

interface PricingConfigProps {
  onPriceChange?: () => void;
}

export function PricingConfig({ onPriceChange }: PricingConfigProps) {
  const { isDarkMode: darkMode } = useTheme();
  const [prices, setPrices] = useState<ModelPrice[]>([]);
  const [form, setForm] = useState<PriceForm>({
    model: "",
    inputPricePer1M: "",
    cachedInputPricePer1M: "",
    outputPricePer1M: "",
  });
  const [editingPrice, setEditingPrice] = useState<ModelPrice | null>(null);
  const [editForm, setEditForm] = useState<PriceForm>({
    model: "",
    inputPricePer1M: "",
    cachedInputPricePer1M: "",
    outputPricePer1M: "",
  });
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // 加载价格列表
  useEffect(() => {
    fetch("/api/prices")
      .then((res) => res.json())
      .then((data) => setPrices(data.prices || []))
      .catch((err) => console.error("加载价格失败", err));
  }, []);

  // 添加价格
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.model.trim() || !form.inputPricePer1M || !form.outputPricePer1M) {
      setStatus("请填写必填项");
      return;
    }

    setSaving(true);
    setStatus(null);

    try {
      const payload = {
        model: form.model.trim(),
        inputPricePer1M: Number(form.inputPricePer1M),
        cachedInputPricePer1M: Number(form.cachedInputPricePer1M) || 0,
        outputPricePer1M: Number(form.outputPricePer1M),
      };

      const res = await fetch("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setPrices((prev) => {
          const others = prev.filter((p) => p.model !== payload.model);
          return [...others, payload].sort((a, b) => a.model.localeCompare(b.model));
        });
        setForm({ model: "", inputPricePer1M: "", cachedInputPricePer1M: "", outputPricePer1M: "" });
        setStatus("已保存");
        onPriceChange?.();
      } else {
        setStatus("保存失败");
      }
    } catch (err) {
      console.error("保存失败", err);
      setStatus("保存失败");
    } finally {
      setSaving(false);
    }
  };

  // 打开编辑弹窗
  const openEditModal = (price: ModelPrice) => {
    setEditingPrice(price);
    setEditForm({
      model: price.model,
      inputPricePer1M: String(price.inputPricePer1M),
      cachedInputPricePer1M: String(price.cachedInputPricePer1M || 0),
      outputPricePer1M: String(price.outputPricePer1M),
    });
  };

  // 保存编辑
  const handleEditSave = async () => {
    if (!editingPrice) return;

    const payload = {
      model: editForm.model.trim(),
      inputPricePer1M: Number(editForm.inputPricePer1M),
      cachedInputPricePer1M: Number(editForm.cachedInputPricePer1M) || 0,
      outputPricePer1M: Number(editForm.outputPricePer1M),
    };

    try {
      // 如果模型名改变了，先删除旧模型
      if (editingPrice.model !== payload.model) {
        await fetch("/api/prices", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: editingPrice.model }),
        });
      }

      const res = await fetch("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setPrices((prev) => {
          const others = prev.filter((p) => p.model !== editingPrice.model && p.model !== payload.model);
          return [...others, payload].sort((a, b) => a.model.localeCompare(b.model));
        });
        setEditingPrice(null);
        onPriceChange?.();
      }
    } catch (err) {
      console.error("保存失败", err);
    }
  };

  // 删除价格
  const handleDelete = async (model: string) => {
    try {
      const res = await fetch("/api/prices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });

      if (res.ok) {
        setPrices((prev) => prev.filter((p) => p.model !== model));
        setPendingDelete(null);
        onPriceChange?.();
      }
    } catch (err) {
      console.error("删除失败", err);
    }
  };

  const priceModelOptions = prices.map((p) => p.model);

  return (
    <section
      className={`glass-panel rounded-lg p-6 shadow-sm ${
        darkMode ? "ring-1 ring-slate-700" : "ring-1 ring-slate-200"
      }`}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className={`text-lg font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>
            模型价格配置
          </h2>
          <p className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
            设置每百万 tokens 单价，费用计算将立即更新
          </p>
        </div>
        {status && (
          <p className={`text-xs ${status === "已保存" ? "text-emerald-400" : "text-red-400"}`}>
            {status}
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <form
          onSubmit={handleSubmit}
          className={`rounded-xl border p-5 lg:col-span-2 ${
            darkMode ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"
          }`}
        >
          <div className="grid gap-4">
            <label className={`text-sm font-medium ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
              模型名称
              <ComboBox
                value={form.model}
                onChange={(val) => setForm((f) => ({ ...f, model: val }))}
                options={priceModelOptions}
                placeholder="gpt-4o（支持通配符如 gemini-2*）"
                darkMode={darkMode}
                className="mt-1 w-full"
              />
            </label>
            <label className={`text-sm font-medium ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
              输入（$ / M tokens）
              <input
                type="number"
                step="0.01"
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none ${
                  darkMode
                    ? "border-slate-700 bg-slate-900 text-white placeholder-slate-500"
                    : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
                }`}
                placeholder="2.5"
                value={form.inputPricePer1M}
                onChange={(e) => setForm((f) => ({ ...f, inputPricePer1M: e.target.value }))}
              />
            </label>
            <label className={`text-sm font-medium ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
              缓存输入（$ / M tokens）
              <input
                type="number"
                step="0.01"
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none ${
                  darkMode
                    ? "border-slate-700 bg-slate-900 text-white placeholder-slate-500"
                    : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
                }`}
                placeholder="0.5（可选，默认为 0）"
                value={form.cachedInputPricePer1M}
                onChange={(e) => setForm((f) => ({ ...f, cachedInputPricePer1M: e.target.value }))}
              />
            </label>
            <label className={`text-sm font-medium ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
              输出（$ / M tokens）
              <input
                type="number"
                step="0.01"
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none ${
                  darkMode
                    ? "border-slate-700 bg-slate-900 text-white placeholder-slate-500"
                    : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
                }`}
                placeholder="10"
                value={form.outputPricePer1M}
                onChange={(e) => setForm((f) => ({ ...f, outputPricePer1M: e.target.value }))}
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-60"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? "保存中..." : "保存价格"}
            </button>
          </div>
        </form>

        <div className="lg:col-span-3">
          <div className="scrollbar-slim grid max-h-[400px] gap-3 overflow-y-auto pr-1">
            {prices.length ? (
              prices.map((price) => (
                <div
                  key={price.model}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                    darkMode ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div>
                    <p className={`text-base font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>
                      {price.model}
                    </p>
                    <p className={`text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                      ${price.inputPricePer1M}/M 输入
                      {price.cachedInputPricePer1M > 0 && ` • $${price.cachedInputPricePer1M}/M 缓存`}
                      {" • "}${price.outputPricePer1M}/M 输出
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(price)}
                      className={`rounded-lg p-2 transition ${
                        darkMode
                          ? "text-slate-400 hover:bg-slate-700 hover:text-white"
                          : "text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                      }`}
                      title="编辑"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(price.model)}
                      className={`rounded-lg p-2 transition ${
                        darkMode
                          ? "text-red-400 hover:bg-red-900/50 hover:text-red-300"
                          : "text-red-500 hover:bg-red-100 hover:text-red-700"
                      }`}
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div
                className={`flex flex-col items-center justify-center rounded-xl border border-dashed py-8 text-center ${
                  darkMode ? "border-slate-700 bg-slate-800/30" : "border-slate-300 bg-slate-50"
                }`}
              >
                <p className="text-base text-slate-400">暂无已配置价格</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 编辑价格模态框 */}
      <Modal isOpen={!!editingPrice} onClose={() => setEditingPrice(null)} title="编辑价格" darkMode={darkMode}>
        <div className="mt-4 grid gap-3">
          <label className={`text-sm font-medium ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
            模型名称
            <input
              type="text"
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none ${
                darkMode
                  ? "border-slate-700 bg-slate-900 text-white placeholder-slate-500"
                  : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
              }`}
              placeholder="模型名称"
              value={editForm.model}
              onChange={(e) => setEditForm((f) => ({ ...f, model: e.target.value }))}
            />
          </label>
          <label className={`text-sm font-medium ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
            输入（$ / M tokens）
            <input
              type="number"
              step="0.01"
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none ${
                darkMode
                  ? "border-slate-700 bg-slate-900 text-white placeholder-slate-500"
                  : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
              }`}
              value={editForm.inputPricePer1M}
              onChange={(e) => setEditForm((f) => ({ ...f, inputPricePer1M: e.target.value }))}
            />
          </label>
          <label className={`text-sm font-medium ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
            缓存输入（$ / M tokens）
            <input
              type="number"
              step="0.01"
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none ${
                darkMode
                  ? "border-slate-700 bg-slate-900 text-white placeholder-slate-500"
                  : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
              }`}
              value={editForm.cachedInputPricePer1M}
              onChange={(e) => setEditForm((f) => ({ ...f, cachedInputPricePer1M: e.target.value }))}
            />
          </label>
          <label className={`text-sm font-medium ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
            输出（$ / M tokens）
            <input
              type="number"
              step="0.01"
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none ${
                darkMode
                  ? "border-slate-700 bg-slate-900 text-white placeholder-slate-500"
                  : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
              }`}
              value={editForm.outputPricePer1M}
              onChange={(e) => setEditForm((f) => ({ ...f, outputPricePer1M: e.target.value }))}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingPrice(null)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                darkMode ? "text-slate-300 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleEditSave}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              保存
            </button>
          </div>
        </div>
      </Modal>

      {/* 删除确认模态框 */}
      <Modal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="确认删除"
        darkMode={darkMode}
      >
        <p className={`mt-4 text-sm ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
          确定要删除模型 <strong>{pendingDelete}</strong> 的价格配置吗？
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setPendingDelete(null)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              darkMode ? "text-slate-300 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => pendingDelete && handleDelete(pendingDelete)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
          >
            删除
          </button>
        </div>
      </Modal>
    </section>
  );
}
