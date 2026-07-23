import { Bell, CheckCheck, Loader2, Mail, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/apiClient.js";

function dateTime(value) {
  return value ? new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";
}

export default function PayrollNotificationsView() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try { setNotifications(await apiRequest("/api/notifications")); setError(""); }
    catch (loadError) { setError(loadError.message || "Unable to load notifications."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const open = async (notification) => {
    if (!notification.is_read) {
      await apiRequest(`/api/notifications/${notification.notification_id}/read`, { method: "PUT" }).catch(() => {});
      setNotifications((current) => current.map((item) => item.notification_id === notification.notification_id ? { ...item, is_read: 1 } : item));
    }
    if (notification.action_path) navigate(notification.action_path);
  };

  const markAllRead = async () => {
    await apiRequest("/api/notifications/read-all", { method: "PUT" });
    setNotifications((current) => current.map((item) => ({ ...item, is_read: 1 })));
  };

  const unread = notifications.filter((item) => !item.is_read).length;
  return <section className="space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div>
      <h2 className="text-2xl font-semibold text-[#251E1F]">Notifications</h2>
      <p className="mt-2 text-sm text-[#7b6660]">Payroll actions requiring your attention and outcomes you need to know.</p>
    </div><div className="flex gap-2"><button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-[#f0d2ca] bg-white px-4 py-2.5 text-sm font-semibold"><RefreshCw size={16}/>Refresh</button><button disabled={!unread} onClick={markAllRead} className="primary-button inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><CheckCheck size={16}/>Mark all read</button></div></header>
    {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
    <div className="app-panel overflow-hidden rounded-2xl">{loading ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-[#7b6660]"><Loader2 className="animate-spin" size={18}/>Loading notifications...</div> : notifications.length ?
      <div className="divide-y divide-[#f0d2ca]">{notifications.map((item) => <button type="button" key={item.notification_id} onClick={() => open(item)} className={`flex w-full items-start gap-4 p-5 text-left transition hover:bg-[#fff8f5] ${item.is_read ? "bg-white" : "bg-[#FDD9CD]/25"}`}>
        <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.is_read ? "bg-[#fff8f5] text-[#7b6660]" : "bg-[#F38978]/15 text-[#F38978]"}`}><Bell size={18}/></div>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-[#251E1F]">{item.title}</p><span className="text-xs text-[#7b6660]">{dateTime(item.created_at)}</span></div><p className="mt-1 text-sm text-[#7b6660]">{item.message}</p><div className="mt-3 flex flex-wrap gap-3 text-xs text-[#7b6660]"><span>{item.actor_name ? `By ${item.actor_name}` : "System"}</span><span className="inline-flex items-center gap-1"><Mail size={12}/>{item.delivery_status || "In app"}</span>{item.action_path ? <span className="font-semibold text-[#F38978]">Open required action →</span> : null}</div></div>
      </button>)}</div> : <div className="p-12 text-center"><Bell className="mx-auto text-[#F38978]"/><p className="mt-3 font-semibold text-[#251E1F]">You are all caught up</p><p className="mt-1 text-sm text-[#7b6660]">No payroll notifications are available.</p></div>}</div>
  </section>;
}
