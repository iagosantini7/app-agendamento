import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Droplets,
  Sparkles,
  Wrench,
  Gem,
  Car,
  Clock,
  User,
  Phone,
  Check,
  X,
  Trash2,
  Plus,
  Pencil,
  ChevronLeft,
  CalendarCheck2,
  ClipboardList,
  Settings2,
  Loader2,
  CarFront,
  Truck,
  Lock,
  Mail,
  LogOut,
  AlertTriangle,
  ListChecks,
  ShieldAlert,
  Ban,
} from "lucide-react";
import { supabase } from "./supabaseClient";

// ---------- Theme tokens ----------
const C = {
  bg: "#14161A",
  surface: "#1C1F24",
  surfaceRaised: "#242830",
  border: "#2E323A",
  borderSoft: "#23262C",
  textPrimary: "#EDEFF2",
  textMuted: "#8D93A0",
  textFaint: "#5C616C",
  accent: "#F2B705",
  accentSoft: "rgba(242,183,5,0.14)",
  info: "#4FC3E8",
  infoSoft: "rgba(79,195,232,0.14)",
  success: "#4CAF7D",
  successSoft: "rgba(76,175,125,0.14)",
  danger: "#E5584D",
  dangerSoft: "rgba(229,88,77,0.16)",
};

const FONT_HEAD = "'Oswald', 'Arial Narrow', sans-serif";
const FONT_BODY = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";

const VEHICLE_TYPES = [
  { id: "pequeno", label: "Pequeno", hint: "hatch / compacto", icon: Car },
  { id: "medio", label: "Médio", hint: "sedan / SUV compacto", icon: CarFront },
  { id: "grande", label: "Grande", hint: "SUV grande / picape", icon: Truck },
];

const TIME_SLOTS = ["08:00", "13:00"];
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const STATUS_META = {
  pendente: { label: "Pendente", tone: "amber" },
  confirmado: { label: "Confirmado", tone: "blue" },
  concluido: { label: "Concluído", tone: "green" },
  cancelado: { label: "Cancelado", tone: "red" },
};

// ---------- Helpers ----------

function iconForService(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("vitrific")) return Gem;
  if (n.includes("polim")) return Sparkles;
  if (n.includes("técnic") || n.includes("tecnic")) return Wrench;
  if (n.includes("lavagem")) return Droplets;
  return Car;
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatMoney(v) {
  return "R$ " + Number(v || 0).toFixed(2).replace(".", ",");
}

function priceRange(service) {
  const vals = Object.values(service.prices || {});
  if (vals.length === 0) return "—";
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  return min === max ? formatMoney(min) : `${formatMoney(min)} – ${formatMoney(max)}`;
}

function formatDuration(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h${m}min`;
  if (h) return `${h}h`;
  return `${m}min`;
}

function nextWeekdays(count) {
  const arr = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let d = new Date(today);
  while (arr.length < count) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) arr.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return arr;
}

function formatDateFull(key) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${WEEKDAYS[dt.getDay()]}, ${d} de ${MONTHS[m - 1]}`;
}

function dayAppointmentsFor(appointments, key) {
  return appointments.filter((a) => a.date === key && a.status !== "cancelado");
}

function isSlotBookable(date, timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  const slotDateTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0, 0);
  return slotDateTime.getTime() > Date.now();
}

function isDateAvailable(date, pseudoService, appointments) {
  const key = dateKey(date);
  const dayAppts = dayAppointmentsFor(appointments, key);
  const hasFullDayBlock = dayAppts.some((a) => a.fullDay);
  if (hasFullDayBlock) return false;

  const bookableSlots = TIME_SLOTS.filter((t) => isSlotBookable(date, t));
  if (bookableSlots.length === 0) return false;

  if (pseudoService && pseudoService.fullDay) {
    // O atendimento de dia todo começa às 08:00, então só cabe se esse horário ainda não passou.
    return dayAppts.length === 0 && bookableSlots.includes("08:00");
  }
  const takenTimes = new Set(dayAppts.map((a) => a.time));
  return bookableSlots.some((t) => !takenTimes.has(t));
}

// ---------- DB <-> app shape mapping ----------

function serviceFromRow(r) {
  return {
    id: r.id,
    name: r.name,
    duration: r.duration_min,
    fullDay: r.full_day,
    prices: { pequeno: Number(r.price_pequeno), medio: Number(r.price_medio), grande: Number(r.price_grande) },
  };
}

function apptFromRow(r) {
  return {
    id: r.id,
    services: r.services || [],
    fullDay: r.full_day,
    vehicle: r.vehicle,
    price: Number(r.price),
    duration: r.duration_min,
    date: r.appt_date,
    time: r.appt_time,
    clientId: r.client_id || null,
    clientName: r.client_name,
    clientPhone: r.client_phone,
    notes: r.notes || "",
    status: r.status,
    createdAt: r.created_at,
  };
}

// ---------- Small UI primitives ----------

function Pill({ children, tone = "muted", style }) {
  const tones = {
    muted: { bg: C.surfaceRaised, fg: C.textMuted },
    amber: { bg: C.accentSoft, fg: C.accent },
    blue: { bg: C.infoSoft, fg: C.info },
    green: { bg: C.successSoft, fg: C.success },
    red: { bg: C.dangerSoft, fg: C.danger },
  };
  const t = tones[tone] || tones.muted;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 5, fontSize: 12, fontWeight: 600, background: t.bg, color: t.fg, ...style }}>
      {children}
    </span>
  );
}

function PrimaryButton({ children, onClick, disabled, style, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: "13px 16px", borderRadius: 8, border: "none",
        background: disabled ? C.surfaceRaised : C.accent, color: disabled ? C.textFaint : "#1A1500",
        fontFamily: FONT_BODY, fontWeight: 700, fontSize: 15, cursor: disabled ? "not-allowed" : "pointer",
        transition: "transform 0.1s ease", ...style,
      }}
      onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = "scale(0.98)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {Icon && <Icon size={17} />}
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, style, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 14px",
        borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textPrimary,
        fontFamily: FONT_BODY, fontWeight: 600, fontSize: 14, cursor: "pointer", ...style,
      }}
    >
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}

function FieldInput({ icon: Icon, placeholder, value, onChange, type = "text" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${C.border}`, borderRadius: 9, padding: "11px 14px", background: C.surface }}>
      <Icon size={16} color={C.textMuted} />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: C.textPrimary, fontSize: 14 }}
      />
    </div>
  );
}

function SectionTitle({ children }) {
  return <div style={{ fontFamily: FONT_HEAD, fontSize: 18, fontWeight: 600, color: C.textPrimary }}>{children}</div>;
}

function Row({ label, value, last }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: last ? "none" : `1px solid ${C.borderSoft}` }}>
      <span style={{ color: C.textMuted, fontSize: 13 }}>{label}</span>
      <span style={{ color: C.textPrimary, fontSize: 13.5, fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function EmptyNote({ children }) {
  return <div style={{ padding: "20px 0", textAlign: "center", color: C.textFaint, fontSize: 13.5 }}>{children}</div>;
}

function MiniButton({ tone, icon: Icon, onClick, children }) {
  const tones = {
    blue: { bg: C.infoSoft, fg: C.info },
    green: { bg: C.successSoft, fg: C.success },
    red: { bg: C.dangerSoft, fg: C.danger },
    muted: { bg: C.surfaceRaised, fg: C.textMuted },
  };
  const t = tones[tone];
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 6, border: "none", background: t.bg, color: t.fg, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
      <Icon size={12} /> {children}
    </button>
  );
}

function SmallInput({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ flex: 1, padding: "9px 12px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.surfaceRaised, color: C.textPrimary, fontSize: 13.5, outline: "none" }}
    />
  );
}

// ---------- Main App ----------

export default function App() {
  const [ready, setReady] = useState(false);
  const [configMissing, setConfigMissing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [view, setView] = useState("client");
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(undefined); // undefined=loading, null=none found, object=loaded

  const refreshServices = useCallback(async () => {
    const { data, error } = await supabase.from("services").select("*").order("name");
    if (error) throw error;
    setServices((data || []).map(serviceFromRow));
  }, []);

  const refreshAppointments = useCallback(async () => {
    const { data, error } = await supabase.from("appointments").select("*").order("appt_date").order("appt_time");
    if (error) throw error;
    setAppointments((data || []).map(apptFromRow));
  }, []);

  const refreshProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    setProfile(undefined);
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) {
      setProfile(null);
      return;
    }
    setProfile(data || null);
  }, []);

  useEffect(() => {
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      setConfigMissing(true);
      setReady(true);
      return;
    }

    (async () => {
      try {
        await Promise.all([refreshServices(), refreshAppointments()]);
      } catch (e) {
        setLoadError(e.message || "Não foi possível carregar os dados.");
      }
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      await refreshProfile(data.session?.user?.id);
      setReady(true);
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      refreshProfile(newSession?.user?.id);
    });

    const servicesChannel = supabase
      .channel("services-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "services" }, () => refreshServices())
      .subscribe();

    const appointmentsChannel = supabase
      .channel("appointments-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => refreshAppointments())
      .subscribe();

    return () => {
      authListener?.subscription?.unsubscribe();
      supabase.removeChannel(servicesChannel);
      supabase.removeChannel(appointmentsChannel);
    };
  }, [refreshServices, refreshAppointments, refreshProfile]);

  const isAdmin = profile?.role === "admin";

  // ---- Service mutations ----
  async function addService(payload) {
    const { error } = await supabase.from("services").insert({
      name: payload.name,
      duration_min: payload.duration,
      full_day: payload.fullDay,
      price_pequeno: payload.prices.pequeno,
      price_medio: payload.prices.medio,
      price_grande: payload.prices.grande,
    });
    if (error) throw error;
    await refreshServices();
  }

  async function updateService(id, payload) {
    const { error } = await supabase
      .from("services")
      .update({
        name: payload.name,
        duration_min: payload.duration,
        full_day: payload.fullDay,
        price_pequeno: payload.prices.pequeno,
        price_medio: payload.prices.medio,
        price_grande: payload.prices.grande,
      })
      .eq("id", id);
    if (error) throw error;
    await refreshServices();
  }

  async function deleteService(id) {
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) throw error;
    await refreshServices();
  }

  // ---- Appointment mutations ----
  async function addAppointment(appt) {
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        services: appt.services,
        full_day: appt.fullDay,
        vehicle: appt.vehicle,
        price: appt.price,
        duration_min: appt.duration,
        appt_date: appt.date,
        appt_time: appt.time,
        client_id: session?.user?.id ?? null,
        client_name: appt.clientName,
        client_phone: appt.clientPhone,
        notes: appt.notes,
        status: "pendente",
      })
      .select()
      .single();
    if (error) throw error;
    await refreshAppointments();
    return apptFromRow(data);
  }

  async function updateAppointmentStatus(id, status) {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) throw error;
    await refreshAppointments();
  }

  async function deleteAppointment(id) {
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) throw error;
    await refreshAppointments();
  }

  if (configMissing) {
    return <SetupNotice />;
  }

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_BODY, color: C.textMuted }}>
        <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ marginLeft: 10 }}>Carregando agenda…</span>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", justifyContent: "center", fontFamily: FONT_BODY }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        input, select { font-family: ${FONT_BODY}; }
        input::placeholder { color: ${C.textFaint}; }
      `}</style>
      <div style={{ width: "100%", maxWidth: 430, minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", borderLeft: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}` }}>
        <Header isAdmin={isAdmin} onAdminAccess={() => setView("admin")} />
        {loadError && (
          <div style={{ margin: "0 16px", marginTop: 10, padding: "8px 12px", borderRadius: 6, background: C.dangerSoft, color: C.danger, fontSize: 12.5, display: "flex", gap: 8, alignItems: "center" }}>
            <AlertTriangle size={14} /> {loadError}
          </div>
        )}

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {view === "client" ? (
            <ClientFlow services={services} appointments={appointments} onBook={addAppointment} session={session} profile={profile} />
          ) : view === "my" ? (
            !session ? (
              <ClientAuthGate />
            ) : (
              <MyAppointments
                appointments={appointments}
                session={session}
                onCancel={updateAppointmentStatus}
                onLogout={() => supabase.auth.signOut()}
              />
            )
          ) : !session ? (
            <AdminLoginGate />
          ) : profile === undefined ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, gap: 8 }}>
              <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> Verificando acesso…
            </div>
          ) : !isAdmin ? (
            <RestrictedNotice onLogout={() => supabase.auth.signOut()} />
          ) : (
            <AdminPanel
              services={services}
              appointments={appointments}
              onAddService={addService}
              onUpdateService={updateService}
              onDeleteService={deleteService}
              onUpdateStatus={updateAppointmentStatus}
              onDeleteAppointment={deleteAppointment}
              onLogout={() => supabase.auth.signOut()}
            />
          )}
        </div>

        <BottomNav
          view={view}
          setView={setView}
          isAdmin={isAdmin}
          pendingCount={appointments.filter((a) => a.status === "pendente").length}
        />
      </div>
    </div>
  );
}

function SetupNotice() {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_BODY, padding: 24 }}>
      <div style={{ maxWidth: 420, textAlign: "center", color: C.textPrimary }}>
        <AlertTriangle size={28} color={C.accent} style={{ marginBottom: 12 }} />
        <div style={{ fontFamily: FONT_HEAD, fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Configuração pendente</div>
        <div style={{ color: C.textMuted, fontSize: 14, lineHeight: 1.6 }}>
          Crie um arquivo <code>.env</code> na raiz do projeto (copie de <code>.env.example</code>) com a URL e a chave anônima
          do seu projeto Supabase, depois reinicie o app.
        </div>
      </div>
    </div>
  );
}

function Header({ isAdmin, onAdminAccess }) {
  return (
    <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 8, background: C.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Car size={20} color={C.accent} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FONT_HEAD, fontSize: 18.5, fontWeight: 600, color: C.textPrimary, lineHeight: 1.15 }}>AGRC Estética Automotiva</div>
        <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2 }}>Agende seu carro em poucos toques</div>
      </div>
      {!isAdmin && (
        <button
          onClick={onAdminAccess}
          title="Acesso administrativo"
          aria-label="Acesso administrativo"
          style={{ background: "none", border: "none", color: C.textFaint, cursor: "pointer", padding: 6, flexShrink: 0 }}
        >
          <Lock size={14} />
        </button>
      )}
    </div>
  );
}

function BottomNav({ view, setView, isAdmin, pendingCount }) {
  const items = [
    { key: "client", label: "Agendar", icon: CalendarCheck2 },
    { key: "my", label: "Meus agend.", icon: ListChecks },
  ];
  if (isAdmin) {
    items.push({ key: "admin", label: "Painel", icon: ClipboardList, badge: pendingCount });
  }
  return (
    <div style={{ display: "flex", borderTop: `1px solid ${C.border}`, background: C.surface }}>
      {items.map((it) => {
        const active = view === it.key;
        return (
          <button
            key={it.key}
            onClick={() => setView(it.key)}
            style={{ flex: 1, padding: "12px 8px 14px", background: "transparent", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", position: "relative", color: active ? C.accent : C.textMuted }}
          >
            <div style={{ position: "relative" }}>
              <it.icon size={19} />
              {!!it.badge && (
                <span style={{ position: "absolute", top: -5, right: -8, background: C.danger, color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 8, padding: "1px 5px", lineHeight: 1.3 }}>
                  {it.badge}
                </span>
              )}
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 600 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- Client booking flow ----------

const STEP_LABELS = ["Serviços", "Veículo", "Data", "Dados", "Revisão"];

function ClientFlow({ services, appointments, onBook, session, profile }) {
  const [step, setStep] = useState(1);
  const [serviceIds, setServiceIds] = useState([]);
  const [vehicle, setVehicle] = useState(null);
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (profile) {
      if (profile.full_name && !name) setName(profile.full_name);
      if (profile.phone && !phone) setPhone(profile.phone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const days = useMemo(() => nextWeekdays(10), []);
  const selectedServices = services.filter((s) => serviceIds.includes(s.id));
  const isFullDay = selectedServices.some((s) => s.fullDay);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);
  const totalPrice = vehicle ? selectedServices.reduce((sum, s) => sum + (s.prices[vehicle] ?? 0), 0) : null;
  const pseudoService = selectedServices.length ? { fullDay: isFullDay } : null;

  function toggleService(id) {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const takenTimes = useMemo(() => {
    if (!date) return new Set();
    const key = dateKey(date);
    const dayAppts = dayAppointmentsFor(appointments, key);
    const blocked = new Set();
    if (dayAppts.some((a) => a.fullDay)) {
      TIME_SLOTS.forEach((t) => blocked.add(t));
    } else {
      dayAppts.forEach((a) => blocked.add(a.time));
    }
    // Horários cujo início já passou (relevante quando a data escolhida é hoje) também ficam bloqueados.
    TIME_SLOTS.forEach((t) => {
      if (!isSlotBookable(date, t)) blocked.add(t);
    });
    return blocked;
  }, [appointments, date]);

  useEffect(() => {
    if (isFullDay && date) setTime("08:00");
  }, [isFullDay, date]);

  function reset() {
    setStep(1);
    setServiceIds([]);
    setVehicle(null);
    setDate(null);
    setTime(null);
    setName("");
    setPhone("");
    setNotes("");
    setConfirmed(null);
    setSubmitError("");
  }

  async function confirmBooking() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const payload = {
        services: selectedServices.map((s) => ({ id: s.id, name: s.name, duration: s.duration, fullDay: !!s.fullDay, price: vehicle ? s.prices[vehicle] ?? 0 : 0 })),
        fullDay: isFullDay,
        vehicle,
        price: totalPrice,
        duration: totalDuration,
        date: dateKey(date),
        time,
        clientName: name.trim(),
        clientPhone: phone.trim(),
        notes: notes.trim(),
      };
      const inserted = await onBook(payload);
      setConfirmed(inserted);
    } catch (e) {
      setSubmitError("Não foi possível enviar o agendamento. Verifique sua conexão e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    const v = VEHICLE_TYPES.find((x) => x.id === confirmed.vehicle);
    return (
      <div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.successSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Check size={28} color={C.success} />
        </div>
        <div>
          <div style={{ fontFamily: FONT_HEAD, fontSize: 20, color: C.textPrimary, fontWeight: 600 }}>Agendamento enviado</div>
          <div style={{ fontSize: 13.5, color: C.textMuted, marginTop: 6, maxWidth: 280 }}>Seu horário está reservado como pendente. Você recebe a confirmação em breve.</div>
        </div>
        <div style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, textAlign: "left" }}>
          <Row label="Serviços" value={confirmed.services.map((s) => s.name).join(" + ")} />
          <Row label="Veículo" value={v ? v.label : "—"} />
          <Row label="Data" value={formatDateFull(confirmed.date)} />
          <Row label="Horário" value={confirmed.fullDay ? "08:00 (dia todo)" : confirmed.time} />
          <Row label="Valor total" value={formatMoney(confirmed.price)} last />
        </div>
        <PrimaryButton onClick={reset}>Fazer novo agendamento</PrimaryButton>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
      <StepBar step={step} />
      <div style={{ padding: 20, flex: 1 }}>
        {step === 1 && (
          <div>
            <SectionTitle>Escolha os serviços</SectionTitle>
            <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 4 }}>Pode marcar mais de um, por exemplo lavagem completa + vitrificação dos vidros.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
              {services.map((s) => {
                const Icon = iconForService(s.name);
                const active = serviceIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleService(s.id)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderRadius: 10, border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.accentSoft : C.surface, cursor: "pointer", textAlign: "left" }}
                  >
                    <div style={{ width: 20, height: 20, borderRadius: 5, border: `1.5px solid ${active ? C.accent : C.border}`, background: active ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {active && <Check size={13} color="#1A1500" />}
                    </div>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: C.surfaceRaised, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={17} color={active ? C.accent : C.textMuted} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: C.textPrimary, fontWeight: 600, fontSize: 14.5 }}>{s.name}</div>
                      <div style={{ color: C.textMuted, fontSize: 12.5, marginTop: 2, display: "flex", gap: 6, alignItems: "center" }}>
                        {s.fullDay ? "Dia todo" : formatDuration(s.duration)}
                        {s.fullDay && <Pill tone="amber">dia inteiro</Pill>}
                      </div>
                    </div>
                    <div style={{ color: active ? C.accent : C.textPrimary, fontWeight: 700, fontSize: 13.5, textAlign: "right" }}>{priceRange(s)}</div>
                  </button>
                );
              })}
              {services.length === 0 && <EmptyNote>Nenhum serviço cadastrado ainda.</EmptyNote>}
            </div>
            {selectedServices.length > 1 && (
              <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: C.surfaceRaised, color: C.textMuted, fontSize: 12.5 }}>
                {selectedServices.length} serviços selecionados{isFullDay && " · como um deles ocupa o dia todo, o agendamento reserva o dia inteiro"}
              </div>
            )}
          </div>
        )}

        {step === 2 && selectedServices.length > 0 && (
          <div>
            <SectionTitle>Qual o veículo?</SectionTitle>
            <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 4 }}>O valor já soma os {selectedServices.length > 1 ? `${selectedServices.length} serviços escolhidos` : "serviço escolhido"}.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
              {VEHICLE_TYPES.map((v) => {
                const active = vehicle === v.id;
                const sum = selectedServices.reduce((acc, s) => acc + (s.prices[v.id] ?? 0), 0);
                return (
                  <button key={v.id} onClick={() => setVehicle(v.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderRadius: 10, border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.accentSoft : C.surface, cursor: "pointer", textAlign: "left" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: C.surfaceRaised, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <v.icon size={17} color={active ? C.accent : C.textMuted} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: C.textPrimary, fontWeight: 600, fontSize: 14.5 }}>{v.label}</div>
                      <div style={{ color: C.textMuted, fontSize: 12.5, marginTop: 2 }}>{v.hint}</div>
                    </div>
                    <div style={{ color: active ? C.accent : C.textPrimary, fontWeight: 700, fontSize: 14.5 }}>{formatMoney(sum)}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && pseudoService && (
          <div>
            <SectionTitle>Escolha a data</SectionTitle>
            <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 4 }}>
              Atendimento de segunda a sexta.{isFullDay ? " Esses serviços ocupam o dia inteiro, começando às 08:00." : " Horários disponíveis: 08:00 e 13:00."}
            </div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", marginTop: 14, paddingBottom: 6 }}>
              {days.map((d) => {
                const available = isDateAvailable(d, pseudoService, appointments);
                const active = date && dateKey(date) === dateKey(d);
                return (
                  <button
                    key={dateKey(d)}
                    disabled={!available}
                    onClick={() => { setDate(d); setTime(isFullDay ? "08:00" : null); }}
                    style={{ minWidth: 56, padding: "10px 6px", borderRadius: 9, border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.accentSoft : C.surface, color: !available ? C.textFaint : active ? C.accent : C.textPrimary, cursor: !available ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0 }}
                  >
                    <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: "capitalize" }}>{WEEKDAYS[d.getDay()]}</span>
                    <span style={{ fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 600 }}>{d.getDate()}</span>
                    {!available && <span style={{ fontSize: 9 }}>ocupado</span>}
                  </button>
                );
              })}
            </div>

            {date && !isFullDay && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 10 }}>Horário</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                  {TIME_SLOTS.map((t) => {
                    const taken = takenTimes.has(t);
                    const active = time === t;
                    return (
                      <button key={t} disabled={taken} onClick={() => setTime(t)} style={{ padding: "12px 0", borderRadius: 8, border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.accentSoft : taken ? C.borderSoft : C.surface, color: taken ? C.textFaint : active ? C.accent : C.textPrimary, textDecoration: taken ? "line-through" : "none", cursor: taken ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <Clock size={14} /> {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {date && isFullDay && (
              <div style={{ marginTop: 18, padding: 13, borderRadius: 9, background: C.accentSoft, color: C.accent, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                <Clock size={15} /> Início às 08:00 — o dia inteiro fica reservado para esse atendimento.
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div>
            <SectionTitle>Seus dados</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
              <FieldInput icon={User} placeholder="Nome completo" value={name} onChange={setName} />
              <FieldInput icon={Phone} placeholder="WhatsApp (com DDD)" value={phone} onChange={setPhone} />
              <textarea placeholder="Observações sobre o veículo (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ width: "100%", padding: "12px 14px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface, color: C.textPrimary, fontSize: 14, resize: "none", outline: "none" }} />
            </div>
            {session ? (
              <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 6, background: C.successSoft, color: C.success, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <Check size={13} /> Esse agendamento vai aparecer em "Meus agendamentos".
              </div>
            ) : (
              <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 6, background: C.surfaceRaised, color: C.textMuted, fontSize: 12 }}>
                Dica: crie uma conta na aba "Meus agendamentos" para acompanhar o status por lá.
              </div>
            )}
          </div>
        )}

        {step === 5 && selectedServices.length > 0 && (
          <div>
            <SectionTitle>Confirme o agendamento</SectionTitle>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginTop: 14 }}>
              {selectedServices.map((s) => (
                <Row key={s.id} label={s.name} value={formatMoney(s.prices[vehicle] ?? 0)} />
              ))}
              <Row label="Veículo" value={VEHICLE_TYPES.find((v) => v.id === vehicle)?.label} />
              <Row label="Data" value={formatDateFull(dateKey(date))} />
              <Row label="Horário" value={isFullDay ? "08:00 (dia todo)" : time} />
              <Row label="Cliente" value={name} />
              <Row label="WhatsApp" value={phone} />
              <Row label="Valor total" value={formatMoney(totalPrice)} last />
            </div>
            {submitError && (
              <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 6, background: C.dangerSoft, color: C.danger, fontSize: 12.5 }}>{submitError}</div>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: "12px 20px 20px", display: "flex", gap: 10, borderTop: `1px solid ${C.border}` }}>
        {step > 1 && (
          <GhostButton icon={ChevronLeft} onClick={() => setStep(step - 1)} style={{ flex: "0 0 auto" }}>Voltar</GhostButton>
        )}
        {step < 5 && (
          <PrimaryButton
            disabled={(step === 1 && serviceIds.length === 0) || (step === 2 && !vehicle) || (step === 3 && (!date || !time)) || (step === 4 && (!name.trim() || !phone.trim()))}
            onClick={() => setStep(step + 1)}
          >
            Continuar
          </PrimaryButton>
        )}
        {step === 5 && (
          <PrimaryButton icon={CalendarCheck2} onClick={confirmBooking} disabled={submitting}>
            {submitting ? "Enviando…" : "Confirmar agendamento"}
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}

function StepBar({ step }) {
  return (
    <div style={{ display: "flex", padding: "16px 20px 0" }}>
      {STEP_LABELS.map((l, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <div key={l} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ display: "flex", width: "100%", alignItems: "center" }}>
              <div style={{ flex: i === 0 ? 0 : 1, height: 2, background: done || active ? C.accent : C.border }} />
              <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: done ? C.accent : active ? C.accentSoft : C.surfaceRaised, border: active ? `1px solid ${C.accent}` : "none", color: done ? "#1A1500" : active ? C.accent : C.textFaint, fontSize: 10.5, fontWeight: 700 }}>
                {done ? <Check size={11} /> : n}
              </div>
              <div style={{ flex: i === STEP_LABELS.length - 1 ? 0 : 1, height: 2, background: done ? C.accent : C.border }} />
            </div>
            <span style={{ fontSize: 9.5, color: active ? C.textPrimary : C.textFaint, fontWeight: 600, textAlign: "center" }}>{l}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Admin login (Supabase Auth, login only — accounts are promoted via SQL) ----------

function AdminLoginGate() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setError("");
    if (!email.trim() || !password) {
      setError("Preencha e-mail e senha.");
      return;
    }
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (signInError) setError(signInError.message);
  }

  return (
    <div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: C.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
          <Lock size={20} color={C.accent} />
        </div>
        <div style={{ fontFamily: FONT_HEAD, fontSize: 19, fontWeight: 600, color: C.textPrimary }}>Entrar no painel</div>
        <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 4 }}>Área restrita ao administrador da AGRC.</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <FieldInput icon={Mail} placeholder="E-mail" value={email} onChange={setEmail} type="email" />
        <FieldInput icon={Lock} placeholder="Senha" value={password} onChange={setPassword} type="password" />
      </div>

      {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: C.dangerSoft, color: C.danger, fontSize: 12.5, textAlign: "center" }}>{error}</div>}

      <PrimaryButton onClick={handleSubmit} disabled={busy} icon={User}>
        {busy ? "Aguarde…" : "Entrar"}
      </PrimaryButton>
    </div>
  );
}

function RestrictedNotice({ onLogout }) {
  return (
    <div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 14 }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: C.dangerSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ShieldAlert size={22} color={C.danger} />
      </div>
      <div>
        <div style={{ fontFamily: FONT_HEAD, fontSize: 18, fontWeight: 600, color: C.textPrimary }}>Acesso restrito</div>
        <div style={{ fontSize: 13, color: C.textMuted, marginTop: 6, maxWidth: 260 }}>
          Essa área é exclusiva para o administrador da AGRC. Sua conta não tem essa permissão.
        </div>
      </div>
      <GhostButton icon={LogOut} onClick={onLogout}>Sair dessa conta</GhostButton>
    </div>
  );
}

// ---------- Client account (sign up / login) ----------

function ClientAuthGate() {
  const [mode, setMode] = useState("login"); // login | signup
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setError("");
    setNotice("");
    if (!email.trim() || !password) {
      setError("Preencha e-mail e senha.");
      return;
    }
    if (mode === "signup") {
      if (!fullName.trim() || !phone.trim()) {
        setError("Preencha nome e WhatsApp.");
        return;
      }
      if (password.length < 6) {
        setError("Use uma senha com pelo menos 6 caracteres.");
        return;
      }
      if (password !== confirmPassword) {
        setError("As senhas não são iguais.");
        return;
      }
      setBusy(true);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim(), phone: phone.trim() } },
      });
      if (!signUpError && data.session) {
        // Sessão já ativa (confirmação de e-mail desligada no projeto): garante que o perfil tem nome e telefone.
        await supabase.from("profiles").update({ full_name: fullName.trim(), phone: phone.trim() }).eq("id", data.user.id);
      }
      setBusy(false);
      if (signUpError) {
        setError(signUpError.message);
      } else if (!data.session) {
        setNotice("Conta criada. Confirme seu e-mail (enviamos um link) e depois entre.");
        setMode("login");
      }
    } else {
      setBusy(true);
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (signInError) setError(signInError.message);
    }
  }

  return (
    <div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column", justifyContent: "center", gap: 16, overflowY: "auto" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: C.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
          <User size={22} color={C.accent} />
        </div>
        <div style={{ fontFamily: FONT_HEAD, fontSize: 19, fontWeight: 600, color: C.textPrimary }}>{mode === "signup" ? "Criar conta" : "Entrar"}</div>
        <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 4 }}>
          {mode === "signup" ? "Para agendar com seus dados salvos e acompanhar seus serviços." : "Acesse sua conta para ver seus agendamentos."}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {mode === "signup" && (
          <>
            <FieldInput icon={User} placeholder="Nome completo" value={fullName} onChange={setFullName} />
            <FieldInput icon={Phone} placeholder="WhatsApp (com DDD)" value={phone} onChange={setPhone} />
          </>
        )}
        <FieldInput icon={Mail} placeholder="E-mail" value={email} onChange={setEmail} type="email" />
        <FieldInput icon={Lock} placeholder="Senha" value={password} onChange={setPassword} type="password" />
        {mode === "signup" && <FieldInput icon={Lock} placeholder="Confirmar senha" value={confirmPassword} onChange={setConfirmPassword} type="password" />}
      </div>

      {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: C.dangerSoft, color: C.danger, fontSize: 12.5, textAlign: "center" }}>{error}</div>}
      {notice && <div style={{ padding: "8px 12px", borderRadius: 6, background: C.successSoft, color: C.success, fontSize: 12.5, textAlign: "center" }}>{notice}</div>}

      <PrimaryButton onClick={handleSubmit} disabled={busy} icon={mode === "signup" ? Check : User}>
        {busy ? "Aguarde…" : mode === "signup" ? "Criar conta" : "Entrar"}
      </PrimaryButton>

      <button onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); setNotice(""); }} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>
        {mode === "signup" ? "Já tem conta? Entrar" : "Ainda não tem conta? Criar conta"}
      </button>
    </div>
  );
}

// ---------- Meus agendamentos (cliente autenticado) ----------

function MyAppointments({ appointments, session, onCancel, onLogout }) {
  const mine = useMemo(
    () => appointments.filter((a) => a.clientId === session.user.id).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)),
    [appointments, session.user.id]
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
      <div style={{ padding: "16px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionTitle>Meus agendamentos</SectionTitle>
        <button onClick={onLogout} title="Sair" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, cursor: "pointer" }}>
          <LogOut size={14} />
        </button>
      </div>
      <div style={{ padding: 20 }}>
        {mine.length === 0 ? (
          <EmptyNote>Você ainda não tem agendamentos. Vá até a aba "Agendar" para marcar o primeiro.</EmptyNote>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {mine.map((a) => {
              const meta = STATUS_META[a.status] || STATUS_META.pendente;
              const v = VEHICLE_TYPES.find((x) => x.id === a.vehicle);
              const canCancel = a.status === "pendente" || a.status === "confirmado";
              return (
                <div key={a.id} style={{ border: `1px solid ${C.border}`, background: C.surface, borderRadius: 10, padding: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 12.5, color: C.textMuted }}>{formatDateFull(a.date)} · {a.fullDay ? "08:00 (dia todo)" : a.time}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: C.textPrimary, marginTop: 3 }}>{a.services.map((s) => s.name).join(" + ")}</div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{v ? v.label : "—"} · {formatMoney(a.price)}</div>
                    </div>
                    <Pill tone={meta.tone}>{meta.label}</Pill>
                  </div>
                  {canCancel && (
                    <div style={{ marginTop: 10 }}>
                      <MiniButton tone="red" icon={Ban} onClick={() => onCancel(a.id, "cancelado")}>Cancelar agendamento</MiniButton>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Admin panel ----------

function AdminPanel({ services, appointments, onAddService, onUpdateService, onDeleteService, onUpdateStatus, onDeleteAppointment, onLogout }) {
  const [tab, setTab] = useState("agenda");


  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
      <div style={{ display: "flex", gap: 8, padding: "16px 20px 0" }}>
        <SegButton active={tab === "agenda"} onClick={() => setTab("agenda")} icon={ClipboardList}>Agenda</SegButton>
        <SegButton active={tab === "servicos"} onClick={() => setTab("servicos")} icon={Settings2}>Serviços</SegButton>
        <button onClick={onLogout} title="Sair" style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, cursor: "pointer" }}>
          <LogOut size={15} />
        </button>
      </div>
      <div style={{ padding: 20, flex: 1 }}>
        {tab === "agenda" ? (
          <AgendaTab appointments={appointments} onUpdateStatus={onUpdateStatus} onDelete={onDeleteAppointment} />
        ) : (
          <ServicosTab services={services} onAdd={onAddService} onUpdate={onUpdateService} onDelete={onDeleteService} />
        )}
      </div>
    </div>
  );
}

function SegButton({ active, onClick, icon: Icon, children }) {
  return (
    <button onClick={onClick} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 8, border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.accentSoft : "transparent", color: active ? C.accent : C.textMuted, fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>
      <Icon size={14} /> {children}
    </button>
  );
}

function AgendaTab({ appointments, onUpdateStatus, onDelete }) {
  const sorted = useMemo(() => [...appointments].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)), [appointments]);
  const groups = useMemo(() => {
    const map = {};
    sorted.forEach((a) => { map[a.date] = map[a.date] || []; map[a.date].push(a); });
    return Object.entries(map);
  }, [sorted]);

  if (groups.length === 0) return <EmptyNote>Nenhum agendamento ainda. Assim que um cliente agendar, aparece aqui.</EmptyNote>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {groups.map(([date, items]) => (
        <div key={date}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.textMuted, marginBottom: 8, textTransform: "capitalize" }}>{formatDateFull(date)}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((a) => {
              const meta = STATUS_META[a.status] || STATUS_META.pendente;
              const v = VEHICLE_TYPES.find((x) => x.id === a.vehicle);
              return (
                <div key={a.id} style={{ border: `1px solid ${C.border}`, background: C.surface, borderRadius: 10, padding: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ color: C.textPrimary, fontWeight: 700, fontSize: 14 }}>{a.fullDay ? "08:00 · dia todo" : a.time} · {(a.services || []).map((s) => s.name).join(" + ")}</div>
                      <div style={{ color: C.textMuted, fontSize: 12.5, marginTop: 3 }}>{a.clientName} · {a.clientPhone} · {v ? v.label : "veículo n/d"}</div>
                      {a.notes && <div style={{ color: C.textFaint, fontSize: 12, marginTop: 3 }}>{a.notes}</div>}
                    </div>
                    <Pill tone={meta.tone}>{meta.label}</Pill>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    {a.status === "pendente" && <MiniButton tone="blue" icon={Check} onClick={() => onUpdateStatus(a.id, "confirmado")}>Aceitar</MiniButton>}
                    {a.status === "pendente" && <MiniButton tone="red" icon={X} onClick={() => onUpdateStatus(a.id, "cancelado")}>Rejeitar</MiniButton>}
                    {a.status === "confirmado" && <MiniButton tone="green" icon={Check} onClick={() => onUpdateStatus(a.id, "concluido")}>Concluir</MiniButton>}
                    {a.status === "confirmado" && <MiniButton tone="red" icon={X} onClick={() => onUpdateStatus(a.id, "cancelado")}>Cancelar</MiniButton>}
                    <MiniButton tone="muted" icon={Trash2} onClick={() => onDelete(a.id)}>Excluir</MiniButton>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ServicosTab({ services, onAdd, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(blankDraft());
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  function blankDraft() {
    return { name: "", duration: "", fullDay: false, pequeno: "", medio: "", grande: "" };
  }

  function startEdit(s) {
    setEditingId(s.id);
    setDraft({ name: s.name, duration: String(s.duration), fullDay: !!s.fullDay, pequeno: String(s.prices.pequeno ?? ""), medio: String(s.prices.medio ?? ""), grande: String(s.prices.grande ?? "") });
  }

  function parseNum(v) {
    return parseFloat(String(v).replace(",", ".")) || 0;
  }

  function draftToPayload() {
    return {
      name: draft.name.trim(),
      duration: parseInt(draft.duration, 10) || 0,
      fullDay: draft.fullDay,
      prices: { pequeno: parseNum(draft.pequeno), medio: parseNum(draft.medio), grande: parseNum(draft.grande) },
    };
  }

  async function saveEdit(id) {
    setBusy(true);
    try {
      await onUpdate(id, draftToPayload());
      setEditingId(null);
    } finally {
      setBusy(false);
    }
  }

  async function removeService(id) {
    await onDelete(id);
  }

  async function addService() {
    if (!draft.name.trim()) return;
    setBusy(true);
    try {
      await onAdd(draftToPayload());
      setDraft(blankDraft());
      setAdding(false);
    } finally {
      setBusy(false);
    }
  }

  function DraftForm({ onSave, onCancel }) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <SmallInput value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="Nome do serviço" />
        <SmallInput value={draft.duration} onChange={(v) => setDraft({ ...draft, duration: v })} placeholder="Duração (min)" />
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.textMuted }}>
          <input type="checkbox" checked={draft.fullDay} onChange={(e) => setDraft({ ...draft, fullDay: e.target.checked })} />
          Ocupa o dia todo (bloqueia os dois horários)
        </label>
        <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 2 }}>Preço por tamanho de veículo</div>
        <div style={{ display: "flex", gap: 8 }}>
          <SmallInput value={draft.pequeno} onChange={(v) => setDraft({ ...draft, pequeno: v })} placeholder="Pequeno" />
          <SmallInput value={draft.medio} onChange={(v) => setDraft({ ...draft, medio: v })} placeholder="Médio" />
          <SmallInput value={draft.grande} onChange={(v) => setDraft({ ...draft, grande: v })} placeholder="Grande" />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <MiniButton tone="green" icon={Check} onClick={onSave}>{busy ? "Salvando…" : "Salvar"}</MiniButton>
          <MiniButton tone="muted" icon={X} onClick={onCancel}>Cancelar</MiniButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {services.map((s) => {
          const Icon = iconForService(s.name);
          const isEditing = editingId === s.id;
          return (
            <div key={s.id} style={{ border: `1px solid ${C.border}`, background: C.surface, borderRadius: 10, padding: 13 }}>
              {isEditing ? (
                <DraftForm onSave={() => saveEdit(s.id)} onCancel={() => setEditingId(null)} />
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: C.surfaceRaised, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={16} color={C.textMuted} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: C.textPrimary, fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>{s.name} {s.fullDay && <Pill tone="amber">dia todo</Pill>}</div>
                    <div style={{ color: C.textMuted, fontSize: 12.5 }}>{formatDuration(s.duration)} · P {formatMoney(s.prices.pequeno)} · M {formatMoney(s.prices.medio)} · G {formatMoney(s.prices.grande)}</div>
                  </div>
                  <button onClick={() => startEdit(s)} style={{ background: C.surfaceRaised, border: "none", borderRadius: 6, padding: 7, cursor: "pointer" }}>
                    <Pencil size={13} color={C.textMuted} />
                  </button>
                  <button onClick={() => removeService(s.id)} style={{ background: C.dangerSoft, border: "none", borderRadius: 6, padding: 7, cursor: "pointer" }}>
                    <Trash2 size={13} color={C.danger} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {adding ? (
        <div style={{ border: `1px solid ${C.border}`, background: C.surface, borderRadius: 10, padding: 13, marginTop: 10 }}>
          <DraftForm onSave={addService} onCancel={() => { setAdding(false); setDraft(blankDraft()); }} />
        </div>
      ) : (
        <button onClick={() => { setDraft(blankDraft()); setAdding(true); }} style={{ width: "100%", marginTop: 10, padding: "12px 0", borderRadius: 10, border: `1px dashed ${C.border}`, background: "transparent", color: C.textMuted, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", fontWeight: 600, fontSize: 13.5 }}>
          <Plus size={15} /> Novo serviço
        </button>
      )}
    </div>
  );
}
