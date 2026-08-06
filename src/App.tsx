import { type ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { Timestamp } from "firebase/firestore";
import { auth, isFirebaseConfigured } from "./firebase";
import { addMaintenanceItem, addServiceEntry, deleteMaintenanceItem, loadMaintenanceItems, addVehicle, archiveVehicle, importServiceEntries, loadEntries, loadVehicles, recordMileage, updateServiceEntry, updateVehicle, uploadEntryPhoto, uploadVehiclePhoto, type ImportedServiceEntryValues } from "./data";
import { parseMaintenanceCsv } from "./csv";
import { maintenanceStatus, normalizeMoneyToCents, shouldAdvanceMileage } from "./domain";
import { decodeVin, isValidVin, normalizeVin } from "./vin";
import type { MaintenanceItem, ServiceEntry, Vehicle, View } from "./types";

const demoVehicles: Vehicle[] = [
  {
    id: "demo-crv", ownerUserId: "demo", nickname: "The Daily", year: 2015, make: "Honda", model: "CR-V", trim: "EX-L AWD",
    status: "active", latestMileage: 118420, latestMileageDate: Timestamp.fromDate(new Date("2026-07-28")), schemaVersion: 1,
  },
  {
    id: "demo-miata", ownerUserId: "demo", nickname: "Sunday", year: 1994, make: "Mazda", model: "MX-5 Miata", trim: "Base",
    status: "active", latestMileage: 86410, latestMileageDate: Timestamp.fromDate(new Date("2026-06-10")), schemaVersion: 1,
  },
];

const demoEntries: ServiceEntry[] = [
  { id: "e1", ownerUserId: "demo", vehicleId: "demo-crv", description: "Replaced rear brake pads and rotors", title: "Rear brake pads and rotors replaced", serviceDate: Timestamp.fromDate(new Date("2026-07-28")), mileage: 118420, providerType: "diy", totalCostCents: 28644, aiReviewStatus: "not_requested", schemaVersion: 1 },
  { id: "e2", ownerUserId: "demo", vehicleId: "demo-crv", description: "Oil and filter change with Mobil 1 0W-20", title: "Oil and filter changed", serviceDate: Timestamp.fromDate(new Date("2026-04-12")), mileage: 114208, providerType: "diy", totalCostCents: 4298, aiReviewStatus: "not_requested", schemaVersion: 1 },
  { id: "e3", ownerUserId: "demo", vehicleId: "demo-miata", description: "New Continental tires and alignment", title: "Tires replaced and aligned", serviceDate: Timestamp.fromDate(new Date("2026-06-10")), mileage: 86410, providerType: "shop", totalCostCents: 81250, aiReviewStatus: "not_requested", schemaVersion: 1 },
];

function formatMileage(value?: number) { return value == null ? "Mileage not recorded" : `${value.toLocaleString()} mi`; }
function formatDate(value?: Timestamp) { return value ? value.toDate().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"; }
function formatCost(value?: number) { return value == null ? null : new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value / 100); }
function vehicleName(vehicle: Vehicle) { return `${vehicle.year} ${vehicle.make} ${vehicle.model}`; }

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [demo, setDemo] = useState(!isFirebaseConfigured);
  const [vehicles, setVehicles] = useState<Vehicle[]>(demo ? demoVehicles : []);
  const [entries, setEntries] = useState<ServiceEntry[]>(demo ? demoEntries : []);
  const [view, setView] = useState<View>({ name: "garage" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const ownerId = demo ? "demo" : user?.uid;
  const selectedVehicle = view.name === "vehicle" || view.name === "addEntry" || view.name === "editVehicle" || view.name === "importCsv" || view.name === "editEntry"
    ? vehicles.find((vehicle) => vehicle.id === view.vehicleId)
    : undefined;

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(auth, (nextUser) => { setUser(nextUser); setAuthReady(true); });
  }, []);

  useEffect(() => {
    if (!ownerId || demo) return;
    setLoading(true);
    loadVehicles(ownerId)
      .then(setVehicles)
      .catch(() => setError("We couldn't load your garage. Check your connection and try again."))
      .finally(() => setLoading(false));
  }, [ownerId, demo]);

  useEffect(() => {
    if (!ownerId || !selectedVehicle || demo) return;
    loadEntries(ownerId, selectedVehicle.id)
      .then((items) => setEntries((current) => [...current.filter((entry) => entry.vehicleId !== selectedVehicle.id), ...items]))
      .catch(() => setError("We couldn't load this timeline."));
  }, [ownerId, selectedVehicle, demo]);

  if (!authReady) return <LoadingScreen />;
  if (!ownerId) return <AuthScreen onDemo={() => { setDemo(true); setVehicles(demoVehicles); setEntries(demoEntries); }} />;

  const navigate = (next: View) => { setError(""); setView(next); window.scrollTo({ top: 0, behavior: "smooth" }); };

  async function saveVehicle(values: VehicleFormValues) {
    if (demo) {
      const id = `demo-${Date.now()}`;
      setVehicles((current) => [...current, { id, ownerUserId: "demo", status: "active", schemaVersion: 1, ...values }]);
      navigate({ name: "vehicle", vehicleId: id });
      return;
    }
    if (!ownerId) return;
    const created = await addVehicle(ownerId, values);
    const fresh = await loadVehicles(ownerId);
    setVehicles(fresh);
    navigate({ name: "vehicle", vehicleId: created.id });
  }

  async function saveVehicleDetails(vehicleId: string, values: VehicleFormValues) {
    if (demo) {
      setVehicles((current) => current.map((vehicle) => vehicle.id === vehicleId ? { ...vehicle, ...values } : vehicle));
      navigate({ name: "vehicle", vehicleId });
      return;
    }
    await updateVehicle(vehicleId, values);
    if (!ownerId) return;
    setVehicles(await loadVehicles(ownerId));
    navigate({ name: "vehicle", vehicleId });
  }

  async function saveVehiclePhoto(vehicleId: string, file: File) {
    if (demo) {
      const heroImageUrl = URL.createObjectURL(file);
      setVehicles((current) => current.map((vehicle) => vehicle.id === vehicleId ? { ...vehicle, heroImageUrl } : vehicle));
      return;
    }
    if (!ownerId) return;
    const heroImageUrl = await uploadVehiclePhoto(ownerId, vehicleId, file);
    setVehicles((current) => current.map((vehicle) => vehicle.id === vehicleId ? { ...vehicle, heroImageUrl } : vehicle));
  }

  async function saveImportedEntries(vehicleId: string, rows: ImportedServiceEntryValues[]) {
    if (demo) {
      const imported = rows.map((row, index): ServiceEntry => ({ id: `demo-import-${Date.now()}-${index}`, ownerUserId: "demo", vehicleId, ...row, serviceDate: Timestamp.fromDate(new Date(`${row.serviceDate}T12:00:00`)), aiReviewStatus: "not_requested", schemaVersion: 1 }));
      setEntries((current) => [...imported, ...current]);
      navigate({ name: "vehicle", vehicleId });
      return;
    }
    if (!ownerId) return;
    await importServiceEntries(ownerId, vehicleId, rows);
    const [freshVehicles, freshEntries] = await Promise.all([loadVehicles(ownerId), loadEntries(ownerId, vehicleId)]);
    setVehicles(freshVehicles); setEntries((current) => [...current.filter((entry) => entry.vehicleId !== vehicleId), ...freshEntries]);
    navigate({ name: "vehicle", vehicleId });
  }

  async function handleAvatarClick() {
    if (demo) {
      setDemo(false); setVehicles([]); setEntries([]); setView({ name: "garage" });
      return;
    }
    await signOut(auth);
  }

  async function saveEntry(values: EntryFormValues) {
    if (!selectedVehicle) return;
    if (demo) {
      const next: ServiceEntry = {
        id: `demo-entry-${Date.now()}`, ownerUserId: "demo", vehicleId: selectedVehicle.id,
        description: values.description, serviceDate: Timestamp.fromDate(new Date(`${values.serviceDate}T12:00:00`)),
        mileage: values.mileage, providerType: values.providerType, totalCostCents: values.totalCostCents,
        aiReviewStatus: "not_requested", schemaVersion: 1,
      };
      setEntries((current) => [next, ...current]);
      if (values.mileage != null && shouldAdvanceMileage(selectedVehicle.latestMileage, values.mileage)) {
        setVehicles((current) => current.map((vehicle) => vehicle.id === selectedVehicle.id ? { ...vehicle, latestMileage: values.mileage, latestMileageDate: next.serviceDate } : vehicle));
      }
      navigate({ name: "vehicle", vehicleId: selectedVehicle.id });
      return;
    }
    if (!ownerId) return;
    const { photoFiles, ...entryValues } = values;
    const entryId = await addServiceEntry(ownerId, selectedVehicle.id, entryValues);
    if (photoFiles?.length) {
      void Promise.all(photoFiles.map((file) => uploadEntryPhoto(ownerId, selectedVehicle.id, entryId, file)))
        .catch(() => setError("Your entry was saved, but one or more photos could not upload."));
    }
    const [freshVehicles, freshEntries] = await Promise.all([loadVehicles(ownerId), loadEntries(ownerId, selectedVehicle.id)]);
    setVehicles(freshVehicles);
    setEntries((current) => [...current.filter((entry) => entry.vehicleId !== selectedVehicle.id), ...freshEntries]);
    navigate({ name: "vehicle", vehicleId: selectedVehicle.id });
  }

  async function saveMileage(vehicleId: string, mileage: number) {
    const date = new Date().toISOString().slice(0, 10);
    if (demo) { setVehicles((current) => current.map((vehicle) => vehicle.id === vehicleId ? { ...vehicle, latestMileage: mileage, latestMileageDate: Timestamp.fromDate(new Date(`${date}T12:00:00`)) } : vehicle)); return; }
    if (!ownerId) return;
    await recordMileage(ownerId, vehicleId, mileage, date);
    setVehicles(await loadVehicles(ownerId));
  }

  async function saveEditedEntry(entry: ServiceEntry, values: EntryFormValues) {
    const { photoFiles, ...entryValues } = values;
    void photoFiles;
    if (demo) { setEntries((current) => current.map((item) => item.id === entry.id ? { ...item, ...entryValues, serviceDate: Timestamp.fromDate(new Date(`${values.serviceDate}T12:00:00`)) } : item)); navigate({ name: "vehicle", vehicleId: entry.vehicleId }); return; }
    await updateServiceEntry(entry.id, entryValues);
    if (!ownerId) return;
    setEntries((current) => current.map((item) => item.id === entry.id ? { ...item, ...entryValues, serviceDate: Timestamp.fromDate(new Date(`${values.serviceDate}T12:00:00`)) } : item));
    navigate({ name: "vehicle", vehicleId: entry.vehicleId });
  }

  return (
    <div className="app-shell">
      <Sidebar view={view} navigate={navigate} demo={demo} user={user} />
      <div className="app-main">
        <header className="topbar">
          <button className="mobile-brand" onClick={() => navigate({ name: "garage" })} aria-label="Go to My Garage"><span>Ledger</span></button>
          <div className="topbar-actions">
            {demo && <span className="demo-pill">Local preview</span>}
            <button className="icon-button" aria-label="Notifications">♢</button>
            <div className="account-menu"><button className="avatar" onClick={() => setAccountMenuOpen((open) => !open)} aria-label="Account menu" aria-expanded={accountMenuOpen}>{demo ? "CM" : (user?.displayName ?? user?.email ?? "L").slice(0, 2).toUpperCase()}</button>{accountMenuOpen && <div className="account-menu-popover" role="menu"><button role="menuitem" onClick={() => void handleAvatarClick()}>{demo ? "Exit local preview" : "Log out"}</button></div>}</div>
          </div>
        </header>
        {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
        {loading ? <LoadingCards /> : (
          <>
            {view.name === "garage" && <Garage vehicles={vehicles} entries={entries} navigate={navigate} onSaveMileage={saveMileage} />}
            {view.name === "addVehicle" && <VehicleForm onCancel={() => navigate({ name: "garage" })} onSave={saveVehicle} />}
            {view.name === "editVehicle" && selectedVehicle && <VehicleDetailsForm vehicle={selectedVehicle} onCancel={() => navigate({ name: "vehicle", vehicleId: selectedVehicle.id })} onSave={(values) => saveVehicleDetails(selectedVehicle.id, values)} onSaveMileage={(mileage) => saveMileage(selectedVehicle.id, mileage)} onUpload={(file) => saveVehiclePhoto(selectedVehicle.id, file)} />}
            {view.name === "importCsv" && selectedVehicle && <CsvImportForm vehicle={selectedVehicle} onCancel={() => navigate({ name: "vehicle", vehicleId: selectedVehicle.id })} onSave={(rows) => saveImportedEntries(selectedVehicle.id, rows)} />}
            {view.name === "editEntry" && selectedVehicle && entries.find((entry) => entry.id === view.entryId) && <EntryEditForm vehicle={selectedVehicle} entry={entries.find((entry) => entry.id === view.entryId)!} onCancel={() => navigate({ name: "vehicle", vehicleId: selectedVehicle.id })} onSave={(values) => saveEditedEntry(entries.find((entry) => entry.id === view.entryId)!, values)} />}
            {view.name === "vehicle" && selectedVehicle && <VehiclePage vehicle={selectedVehicle} entries={entries.filter((entry) => entry.vehicleId === selectedVehicle.id)} navigate={navigate} onEdit={() => navigate({ name: "editVehicle", vehicleId: selectedVehicle.id })} onImport={() => navigate({ name: "importCsv", vehicleId: selectedVehicle.id })} onArchive={async () => { if (!confirm(`Archive ${vehicleName(selectedVehicle)}?`)) return; if (!demo) await archiveVehicle(selectedVehicle.id); setVehicles((items) => items.filter((item) => item.id !== selectedVehicle.id)); navigate({ name: "garage" }); }} />}
            {view.name === "addEntry" && selectedVehicle && <EntryForm vehicle={selectedVehicle} onCancel={() => navigate({ name: "vehicle", vehicleId: selectedVehicle.id })} onSave={saveEntry} />}
          </>
        )}
      </div>
      <MobileNav view={view} navigate={navigate} selectedVehicle={selectedVehicle} vehicles={vehicles} />
    </div>
  );
}

function Sidebar({ view, navigate, demo, user }: { view: View; navigate: (view: View) => void; demo: boolean; user: User | null }) {
  return <aside className="sidebar"><button className="wordmark" onClick={() => navigate({ name: "garage" })}><span><b>Ledger</b></span></button><nav aria-label="Main navigation"><SidebarLink active={view.name === "garage"} icon="⌂" label="My Garage" onClick={() => navigate({ name: "garage" })} /><SidebarLink icon="◷" label="Reminders" /><SidebarLink icon="▱" label="Documents" /><SidebarLink icon="⌁" label="Reports" /><SidebarLink icon="⚙" label="Settings" /></nav><div className="sidebar-foot"><p>{demo ? "Previewing local sample data" : user?.email}</p>{!demo && <button onClick={() => void signOut(auth)}>Sign out</button>}</div></aside>;
}

function SidebarLink({ icon, label, active, onClick }: { icon: string; label: string; active?: boolean; onClick?: () => void }) {
  return <button className={active ? "nav-link active" : "nav-link"} onClick={onClick} disabled={!onClick}><span>{icon}</span>{label}</button>;
}

function Garage({ vehicles, entries, navigate, onSaveMileage }: { vehicles: Vehicle[]; entries: ServiceEntry[]; navigate: (view: View) => void; onSaveMileage: (vehicleId: string, mileage: number) => Promise<void> }) {
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? ""); const [mileage, setMileage] = useState(""); const [saving, setSaving] = useState(false);
  useEffect(() => { if (!vehicleId && vehicles[0]) setVehicleId(vehicles[0].id); }, [vehicleId, vehicles]);
  async function save() { if (!vehicleId || !mileage) return; setSaving(true); try { await onSaveMileage(vehicleId, Number(mileage)); setMileage(""); } finally { setSaving(false); } }
  return <main className="page"><div className="page-heading"><div><h1>My vehicles<span>.</span></h1></div><button className="primary-button" onClick={() => navigate({ name: "addVehicle" })}><span>?</span> Add vehicle</button></div>{vehicles.length > 0 && <section className="quick-mileage"><div><p className="kicker">Quick mileage</p><strong>Record today&rsquo;s odometer</strong></div><select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicleName(vehicle)}</option>)}</select><input type="number" min="0" value={mileage} onChange={(event) => setMileage(event.target.value)} placeholder="Mileage" /><button className="primary-button" type="button" disabled={saving || !mileage} onClick={() => void save()}>{saving ? "Saving?" : "Save mileage"}</button></section>}{vehicles.length === 0 ? <EmptyGarage onAdd={() => navigate({ name: "addVehicle" })} /> : <div className="garage-grid">{vehicles.map((vehicle, index) => { const vehicleEntries=entries.filter((entry) => entry.vehicleId === vehicle.id); const lastEntry = [...vehicleEntries].sort((a, b) => b.serviceDate.toMillis() - a.serviceDate.toMillis())[0]; return <button className="vehicle-card" key={vehicle.id} onClick={() => navigate({ name: "vehicle", vehicleId: vehicle.id })}><div className={`vehicle-art art-${index % 3}`} style={{ backgroundColor: vehicle.color || undefined }}>{vehicle.heroImageUrl ? <img className="vehicle-art-photo" src={vehicle.heroImageUrl} alt="" /> : <div className="car-silhouette"><i /><i /></div>}<span className="volume">{String(index + 1).padStart(2, "0")}</span></div><div className="vehicle-card-body"><div><p className="card-label">{vehicle.nickname || "In your garage"}</p><h2>{vehicleName(vehicle)}</h2><p>{vehicleEntries.length} {vehicleEntries.length === 1 ? "entry" : "entries"}</p></div><div className="vehicle-facts"><div><span>Latest mileage</span><b>{formatMileage(vehicle.latestMileage)}</b></div><div><span>Last entry</span><b>{lastEntry ? formatDate(lastEntry.serviceDate) : "No entries yet"}</b></div></div></div></button>; })}</div>}</main>;
}

function EmptyGarage({ onAdd }: { onAdd: () => void }) { return <section className="empty-state"><div className="empty-art"><div className="garage-door"><i /><i /><i /></div></div><p className="kicker">A clean start</p><h2>Add your first vehicle</h2><p>Ledger begins with the machine. Add the basics now—you can fill in the details whenever you like.</p><button className="primary-button" onClick={onAdd}>Add your first vehicle</button></section>; }

function VehiclePage({ vehicle, entries, navigate, onEdit, onImport, onArchive }: { vehicle: Vehicle; entries: ServiceEntry[]; navigate: (view: View) => void; onEdit: () => void; onImport: () => void; onArchive: () => void }) {
  const sorted = [...entries].sort((a, b) => b.serviceDate.toMillis() - a.serviceDate.toMillis());
  const total = sorted.reduce((sum, entry) => sum + (entry.totalCostCents ?? 0), 0);
  return <main className="page vehicle-page"><button className="back-link" onClick={() => navigate({ name: "garage" })}>← My Garage</button><section className="vehicle-hero"><div><p className="kicker">{vehicle.nickname || "Vehicle record"}</p><h1>{vehicle.year} {vehicle.make}<br /><em>{vehicle.model}</em><span>.</span></h1><p>{vehicle.trim || "Details can be added at any time"}</p></div><div className="hero-mileage"><span>Latest recorded mileage</span><strong>{vehicle.latestMileage?.toLocaleString() ?? "—"}</strong><small>{vehicle.latestMileage ? `miles · ${formatDate(vehicle.latestMileageDate)}` : "Add mileage with your next entry"}</small></div><div className="hero-actions"><button className="primary-button" onClick={() => navigate({ name: "addEntry", vehicleId: vehicle.id })}>＋ New entry</button><button className="quiet-button" onClick={onEdit}>Edit details</button><button className="quiet-button" onClick={onImport}>Import CSV</button><button className="quiet-button" onClick={onArchive}>Archive vehicle</button></div></section><div className="vehicle-tabs" role="navigation" aria-label="Vehicle sections"><button className="active">Overview</button><button>Timeline</button><button>Documents</button><button>Costs</button><button onClick={onEdit}>Details</button></div><section className="overview-grid"><div className="timeline-panel"><div className="panel-heading"><div><p className="kicker">Vehicle timeline</p><h2>Recent history</h2></div>{sorted.length > 0 && <span>{sorted.length} {sorted.length === 1 ? "entry" : "entries"}</span>}</div>{sorted.length === 0 ? <div className="empty-timeline"><h3>Record what happened</h3><p>Services, repairs, journeys, and observations will appear here.</p><button className="primary-button" onClick={() => navigate({ name: "addEntry", vehicleId: vehicle.id })}>Create first entry</button></div> : <div className="timeline">{sorted.map((entry) => <TimelineItem entry={entry} key={entry.id} onEdit={() => navigate({ name: "editEntry", vehicleId: vehicle.id, entryId: entry.id })} />)}</div>}</div><aside className="overview-side"><div className="side-card reminder-card"><p className="kicker">Next up</p><h3>Nothing is currently due</h3><p>Add a reminder from a future service entry.</p><button>＋ Add reminder</button></div><div className="side-card"><p className="kicker">Recorded costs</p><strong>{formatCost(total) ?? "$0.00"}</strong><p>Across {sorted.length} recorded {sorted.length === 1 ? "entry" : "entries"}</p></div><div className="side-card identity-card"><p className="kicker">Vehicle details</p><dl><div><dt>Year</dt><dd>{vehicle.year}</dd></div><div><dt>Make</dt><dd>{vehicle.make}</dd></div><div><dt>Model</dt><dd>{vehicle.model}</dd></div>{vehicle.vin && <div><dt>VIN</dt><dd>{vehicle.vin.slice(-6).padStart(vehicle.vin.length, "•")}</dd></div>}</dl></div></aside><MaintenancePanel vehicle={vehicle} /></section></main>;
}

function MaintenancePanel({ vehicle }: { vehicle: Vehicle }) {
  const [items, setItems] = useState<MaintenanceItem[]>([]); const [name, setName] = useState(""); const [intervalMiles, setIntervalMiles] = useState("");
  useEffect(() => { void loadMaintenanceItems(vehicle.ownerUserId, vehicle.id).then(setItems); }, [vehicle.id, vehicle.ownerUserId]);
  async function add() { if (!name.trim()) return; const ref = await addMaintenanceItem(vehicle.ownerUserId, vehicle.id, { name: name.trim(), priority: "normal", enabled: true, intervalMiles: intervalMiles ? Number(intervalMiles) : undefined }); setItems((current) => [...current, { id: ref.id, ownerUserId: vehicle.ownerUserId, vehicleId: vehicle.id, name: name.trim(), priority: "normal", enabled: true, intervalMiles: intervalMiles ? Number(intervalMiles) : undefined, schemaVersion: 1 }]); setName(""); setIntervalMiles(""); }
  return <section className="maintenance-panel"><div className="panel-heading"><div><p className="kicker">Maintenance plan</p><h2>Keep ahead</h2></div></div><div className="maintenance-add"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Oil change" /><input value={intervalMiles} onChange={(event) => setIntervalMiles(event.target.value)} type="number" min="1" placeholder="Miles" /><button type="button" className="quiet-button" onClick={() => void add()}>Add item</button></div>{items.filter((item) => item.enabled).length === 0 ? <p className="field-help">Add an owner-defined item to start your maintenance plan.</p> : <div className="maintenance-list">{items.filter((item) => item.enabled).map((item) => <div key={item.id}><span className={`maintenance-status ${maintenanceStatus({ intervalMiles: item.intervalMiles, intervalMonths: item.intervalMonths, lastDoneMileage: item.lastDoneMileage, lastDoneDate: item.lastDoneDate?.toDate() }, vehicle.latestMileage)}`} /><b>{item.name}</b><small>{item.intervalMiles ? `Every ${item.intervalMiles.toLocaleString()} mi` : "Date-based interval"}</small><button type="button" onClick={() => { void deleteMaintenanceItem(item.id); setItems((current) => current.filter((candidate) => candidate.id !== item.id)); }}>Remove</button></div>)}</div>}</section>;
}

function TimelineItem({ entry, onEdit }: { entry: ServiceEntry; onEdit: () => void }) { return <button type="button" className="timeline-item" onClick={onEdit}><div className="timeline-date"><b>{entry.serviceDate.toDate().toLocaleDateString(undefined, { month: "short", day: "numeric" })}</b><span>{entry.serviceDate.toDate().getFullYear()}</span></div><div className="timeline-dot" /><div className="timeline-content"><div><p>{entry.providerType === "diy" ? "DIY service" : entry.providerType === "shop" ? "Shop service" : "Vehicle entry"}</p><h3>{entry.title || entry.description}</h3>{entry.title && <span>{entry.description}</span>}</div><div className="timeline-meta">{entry.mileage != null && <span>{entry.mileage.toLocaleString()} mi</span>}{entry.totalCostCents != null && <span>{formatCost(entry.totalCostCents)}</span>}<span>{entry.providerType || "Not specified"}</span></div></div></button>; }

interface VehicleFormValues { year: number; make: string; model: string; nickname?: string; trim?: string; vin?: string; licensePlate?: string; color?: string }
function VehicleForm({ vehicle, onCancel, onSave }: { vehicle?: Vehicle; onCancel: () => void; onSave: (values: VehicleFormValues) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [error, setError] = useState("");
  const [decodeMessage, setDecodeMessage] = useState("");
  const [values, setValues] = useState(() => ({ year: vehicle ? String(vehicle.year) : "", make: vehicle?.make ?? "", model: vehicle?.model ?? "", trim: vehicle?.trim ?? "", vin: vehicle?.vin ?? "" }));
  const setField = (field: keyof typeof values, value: string) => setValues((current) => ({ ...current, [field]: value }));

  async function handleDecode() {
    setDecodeMessage("");
    const vin = normalizeVin(values.vin);
    setField("vin", vin);
    if (!isValidVin(vin)) { setDecodeMessage("Enter a complete 17-character VIN. VINs do not use I, O, or Q."); return; }
    setDecoding(true);
    try {
      const decoded = await decodeVin(vin);
      setValues((current) => ({ ...current, year: String(decoded.year), make: decoded.make, model: decoded.model, trim: decoded.trim ?? current.trim, vin }));
      setDecodeMessage("Vehicle details found. Review them before saving.");
    } catch (cause) {
      setDecodeMessage(cause instanceof Error ? cause.message : "This VIN could not be decoded. You can still enter the vehicle manually.");
    } finally { setDecoding(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget);
    try { await onSave({ year: Number(values.year), make: values.make.trim(), model: values.model.trim(), nickname: String(form.get("nickname")).trim() || undefined, trim: values.trim.trim() || undefined, vin: normalizeVin(values.vin) || undefined, licensePlate: String(form.get("plate")).trim() || undefined }); }
    catch { setError("We couldn't save this vehicle. Please try again."); setSaving(false); }
  }
  return <main className="form-page"><button className="back-link" onClick={onCancel}>← My Garage</button><div className="form-layout"><div className="form-intro"><p className="kicker">New vehicle</p><h1>What&rsquo;s in<br />your garage<span>?</span></h1><p>Start with the essentials. Everything else can wait.</p><div className="form-number">01 <i /> 02</div></div><form className="ledger-form" onSubmit={submit}><fieldset><legend>The essentials</legend><div className="vin-decode"><label>VIN <small>Optional</small><div className="vin-input"><input value={values.vin} onChange={(event) => { setField("vin", event.target.value.toUpperCase()); setDecodeMessage(""); }} maxLength={17} autoComplete="off" spellCheck={false} placeholder="17-character VIN" aria-describedby="vin-message" /><button type="button" className="quiet-button" onClick={() => void handleDecode()} disabled={decoding || saving}>{decoding ? "Decoding…" : "Decode VIN"}</button></div></label>{decodeMessage && <p id="vin-message" className={decodeMessage.startsWith("Vehicle details") ? "field-success" : "field-help"} role="status">{decodeMessage}</p>}<p className="field-help">Uses the U.S. Department of Transportation&rsquo;s NHTSA vehicle database.</p></div><div className="field-row three"><label>Year<input name="year" type="number" required min="1886" max={new Date().getFullYear() + 1} placeholder="2015" value={values.year} onChange={(event) => setField("year", event.target.value)} /></label><label>Make<input name="make" required placeholder="Honda" value={values.make} onChange={(event) => setField("make", event.target.value)} /></label><label>Model<input name="model" required placeholder="CR-V" value={values.model} onChange={(event) => setField("model", event.target.value)} /></label></div></fieldset><fieldset><legend>Make it yours <small>Optional</small></legend><label>Nickname<input name="nickname" placeholder="The Daily" /></label><label>Trim<input name="trim" placeholder="EX-L AWD" value={values.trim} onChange={(event) => setField("trim", event.target.value)} /></label><label>License plate<input name="plate" placeholder="ABC 1234" /></label></fieldset>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="quiet-button" onClick={onCancel}>Cancel</button><button className="primary-button" disabled={saving || decoding}>{saving ? "Adding vehicle…" : "Add to garage →"}</button></div></form></div></main>;
}

function VehicleDetailsForm({ vehicle, onCancel, onSave, onSaveMileage, onUpload }: { vehicle: Vehicle; onCancel: () => void; onSave: (values: VehicleFormValues) => Promise<void>; onSaveMileage: (mileage: number) => Promise<void>; onUpload: (file: File) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      await onSave({ year: Number(form.get("year")), make: String(form.get("make")).trim(), model: String(form.get("model")).trim(), nickname: String(form.get("nickname")).trim() || undefined, trim: String(form.get("trim")).trim() || undefined, vin: normalizeVin(String(form.get("vin"))) || undefined, licensePlate: String(form.get("plate")).trim() || undefined, color: String(form.get("color")).trim() || undefined });
      const mileage = String(form.get("mileage")).trim(); if (mileage) await onSaveMileage(Number(mileage));
    } catch { setError("We couldn't save these details. Please try again."); setSaving(false); }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setUploading(true); setError("");
    try { await onUpload(file); } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn't upload that photo."); }
    finally { setUploading(false); }
  }

  return <main className="form-page"><button className="back-link" onClick={onCancel}>? {vehicleName(vehicle)}</button><div className="form-layout"><div className="form-intro"><p className="kicker">Vehicle details</p><h1>Keep the<br />record current<span>.</span></h1><p>Update the facts that identify this vehicle.</p></div><form className="ledger-form" onSubmit={submit}><fieldset><legend>Vehicle identity</legend><div className="field-row three"><label>Year<input name="year" type="number" required min="1886" max={new Date().getFullYear() + 1} defaultValue={vehicle.year} /></label><label>Make<input name="make" required defaultValue={vehicle.make} /></label><label>Model<input name="model" required defaultValue={vehicle.model} /></label></div><label>Nickname<input name="nickname" defaultValue={vehicle.nickname} placeholder="The Daily" /></label><label>Trim<input name="trim" defaultValue={vehicle.trim} placeholder="EX-L AWD" /></label><div className="field-row"><label>VIN<input name="vin" defaultValue={vehicle.vin} maxLength={17} autoComplete="off" spellCheck={false} placeholder="17-character VIN" /></label><label>License plate<input name="plate" defaultValue={vehicle.licensePlate} placeholder="ABC 1234" /></label></div><label>Color<input name="color" defaultValue={vehicle.color} placeholder="Deep Black Pearl" /></label><label>Current mileage<input name="mileage" type="number" min="0" defaultValue={vehicle.latestMileage} placeholder="Odometer reading" /></label></fieldset><fieldset><legend>Vehicle photo <small>Optional</small></legend>{vehicle.heroImageUrl && <img className="vehicle-photo-preview" src={vehicle.heroImageUrl} alt={`${vehicleName(vehicle)} profile`} />}<label>Choose photo<input type="file" accept="image/*" onChange={(event) => void upload(event)} disabled={uploading} /></label><p className="field-help">{uploading ? "Uploading photo?" : "JPEG, PNG, HEIC, or WebP up to 10 MB."}</p></fieldset>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="quiet-button" onClick={onCancel}>Cancel</button><button className="primary-button" disabled={saving || uploading}>{saving ? "Saving details?" : "Save details ?"}</button></div></form></div></main>;
}

function CsvImportForm({ vehicle, onCancel, onSave }: { vehicle: Vehicle; onCancel: () => void; onSave: (rows: ImportedServiceEntryValues[]) => Promise<void> }) {
  const [rows, setRows] = useState<ImportedServiceEntryValues[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setError("");
    try {
      const parsed = parseMaintenanceCsv(await file.text());
      if (!parsed.length) throw new Error("No dated maintenance rows were found. Check the CSV headings and try again.");
      setRows(parsed);
    } catch (cause) { setRows([]); setError(cause instanceof Error ? cause.message : "We couldn't read that CSV."); }
  }

  async function submit() {
    setSaving(true); setError("");
    try { await onSave(rows); } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn't import these entries."); setSaving(false); }
  }

  return <main className="form-page"><button className="back-link" onClick={onCancel}>← {vehicleName(vehicle)}</button><div className="form-layout"><div className="form-intro"><p className="kicker">Import history</p><h1>Bring in<br />the record<span>.</span></h1><p>Review every row before it becomes part of this vehicle&rsquo;s timeline.</p></div><section className="ledger-form"><fieldset><legend>Maintenance CSV</legend><label>Choose CSV file<input type="file" accept=".csv,text/csv" onChange={(event) => void chooseFile(event)} /></label><p className="field-help">Supported columns: Date, Odom., Shop, Total Cost, Service, and Estimated Dealer Cost.</p></fieldset>{rows.length > 0 && <><div className="import-summary"><strong>{rows.length} entries ready</strong><span>{formatCost(rows.reduce((total, row) => total + (row.totalCostCents ?? 0), 0))} recorded cost</span><span>{formatCost(rows.reduce((total, row) => total + (row.estimatedShopCostCents ?? 0), 0))} estimated shop cost</span></div><div className="import-preview" aria-label="CSV import preview">{rows.slice(0, 8).map((row, index) => <div key={`${row.serviceDate}-${index}`}><span>{row.serviceDate}</span><b>{row.description}</b><small>{row.mileage?.toLocaleString()} mi · {formatCost(row.totalCostCents) ?? "No cost"} · Est. {formatCost(row.estimatedShopCostCents) ?? "—"}</small></div>)}{rows.length > 8 && <p className="field-help">Plus {rows.length - 8} more entries.</p>}</div></>}{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="quiet-button" onClick={onCancel}>Cancel</button><button type="button" className="primary-button" disabled={!rows.length || saving} onClick={() => void submit()}>{saving ? "Importing…" : `Import ${rows.length || ""} entries →`}</button></div></section></div></main>;
}

interface EntryFormValues { description: string; serviceDate: string; mileage?: number; totalCostCents?: number; providerType?: ServiceEntry["providerType"]; photoFiles?: File[] }
function EntryEditForm({ vehicle, entry, onCancel, onSave }: { vehicle: Vehicle; entry: ServiceEntry; onCancel: () => void; onSave: (values: EntryFormValues) => Promise<void> }) {
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); const form = new FormData(event.currentTarget); try { await onSave({ description: String(form.get("description")).trim(), serviceDate: String(form.get("date")), mileage: String(form.get("mileage")).trim() ? Number(form.get("mileage")) : undefined, totalCostCents: normalizeMoneyToCents(String(form.get("cost"))), providerType: String(form.get("provider")) as ServiceEntry["providerType"] || undefined }); } catch { setError("We couldn't update this entry."); setSaving(false); } }
  return <main className="entry-page"><button className="back-link" onClick={onCancel}>← {vehicleName(vehicle)}</button><div className="entry-heading"><p className="kicker">Edit entry</p><h1>Update the record<span>.</span></h1></div><form className="entry-form" onSubmit={submit}><label className="description-field"><textarea name="description" required defaultValue={entry.description} rows={4} /></label><div className="entry-fields"><label>Date<input name="date" type="date" required defaultValue={entry.serviceDate.toDate().toISOString().slice(0, 10)} /></label><label>Mileage<input name="mileage" type="number" min="0" defaultValue={entry.mileage} /></label><label>Cost<div className="money-field"><span>$</span><input name="cost" type="number" min="0" step=".01" defaultValue={entry.totalCostCents == null ? "" : (entry.totalCostCents / 100).toFixed(2)} /></div></label><label>Performed by<select name="provider" defaultValue={entry.providerType ?? "diy"}><option value="diy">Me</option><option value="shop">Shop</option><option value="dealer">Dealer</option><option value="other">Other</option></select></label></div>{error && <p className="form-error">{error}</p>}<div className="entry-save"><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save changes →"}</button></div></form></main>;
}
function EntryForm({ vehicle, onCancel, onSave }: { vehicle: Vehicle; onCancel: () => void; onSave: (values: EntryFormValues) => Promise<void> }) {
  const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [details, setDetails] = useState(false); const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget); const mileage = String(form.get("mileage")).trim(); const cost = String(form.get("cost")).trim(); try { await onSave({ description: String(form.get("description")).trim(), serviceDate: String(form.get("date")), mileage: mileage ? Number(mileage) : undefined, totalCostCents: normalizeMoneyToCents(cost), providerType: String(form.get("provider")) as ServiceEntry["providerType"] || undefined, photoFiles }); } catch { setError("Your entry is still here, but we couldn't save it. Check your connection and try again."); setSaving(false); } }
  return <main className="entry-page"><button className="back-link" onClick={onCancel}>? {vehicleName(vehicle)}</button><div className="entry-heading"><p className="kicker">New entry ? {vehicle.nickname || vehicleName(vehicle)}</p><h1>What happened<span>?</span></h1><p>Write it the way you&rsquo;d tell a friend. The details can come later.</p></div><form className="entry-form" onSubmit={submit}><label className="description-field"><span className="sr-only">What happened?</span><textarea name="description" required autoFocus placeholder="Replaced rear brake pads and rotors?" rows={4} /></label><div className="entry-fields"><label>Date<input type="date" name="date" required defaultValue={today} /></label><label>Mileage <small>Recommended</small><input type="number" name="mileage" min="0" placeholder={vehicle.latestMileage?.toLocaleString() || "Current mileage"} /></label><label>Cost <small>Optional</small><div className="money-field"><span>$</span><input type="number" name="cost" min="0" step="0.01" placeholder="0.00" /></div></label><label>Performed by <small>Optional</small><select name="provider" defaultValue="diy"><option value="diy">Me</option><option value="shop">Shop</option><option value="dealer">Dealer</option><option value="other">Other</option></select></label></div><button type="button" className="details-toggle" onClick={() => setDetails(!details)}>{details ? "? Hide details" : "+ Add details"}</button>{details && <div className="details-note"><p>Categories, parts, reminders, warranties, and private notes are coming next. The basic record is saved first.</p></div>}<label className="attachment-button"><span>?</span><b>Add receipt or photos</b><small>{photoFiles.length ? `${photoFiles.length} ready to upload` : "JPEG, PNG, HEIC, or WebP ? up to 10 MB"}</small><input className="sr-only" type="file" accept="image/*" multiple onChange={(event) => setPhotoFiles(Array.from(event.target.files ?? []))} /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="entry-save"><p>Entries save first; photo uploads continue independently.</p><button className="primary-button" disabled={saving}>{saving ? "Saving entry?" : "Save entry ?"}</button></div></form></main>;
}

function AuthScreen({ onDemo }: { onDemo: () => void }) {
  const [mode, setMode] = useState<"signin" | "register">("signin"); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function emailAuth(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const data = new FormData(event.currentTarget); try { if (mode === "register") await createUserWithEmailAndPassword(auth, String(data.get("email")), String(data.get("password"))); else await signInWithEmailAndPassword(auth, String(data.get("email")), String(data.get("password"))); } catch { setError("We couldn't sign you in. Check your details and try again."); setBusy(false); } }
  return <main className="auth-page"><section className="auth-story"><div className="auth-brand"><span>Ledger</span></div><div><h1>Remember<br />every mile<span>.</span></h1><p>Services, repairs, receipts, and the details you&rsquo;ll want years from now—kept private and close at hand.</p></div></section><section className="auth-panel"><div className="auth-box"><p className="kicker">Welcome to Ledger</p><h2>{mode === "signin" ? "Open your garage" : "Start your garage"}</h2>{isFirebaseConfigured ? <><form onSubmit={emailAuth}><label>Email address<input type="email" name="email" required autoComplete="email" /></label><label>Password<input type="password" name="password" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button full" disabled={busy}>{busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}</button></form><button className="auth-switch" onClick={() => setMode(mode === "signin" ? "register" : "signin")}>{mode === "signin" ? "New to Ledger? Create an account" : "Already have an account? Sign in"}</button></> : <div className="config-card"><h3>Firebase connection needed</h3><p>No Firebase web app configuration is present yet. The interface and local workflows are ready to review.</p><button className="primary-button full" onClick={onDemo}>Preview the garage</button><small>Choose the Ledger Firebase project to enable private accounts and live data.</small></div>}</div></section></main>;
}

function MobileNav({ view, navigate, selectedVehicle, vehicles }: { view: View; navigate: (view: View) => void; selectedVehicle?: Vehicle; vehicles: Vehicle[] }) { const vehicleId = selectedVehicle?.id || vehicles[0]?.id; return <nav className="mobile-nav" aria-label="Mobile navigation"><button className={view.name === "garage" ? "active" : ""} onClick={() => navigate({ name: "garage" })}><span>⌂</span>Garage</button><button><span>◷</span>Reminders</button><button className="mobile-add" disabled={!vehicleId} onClick={() => vehicleId && navigate({ name: "addEntry", vehicleId })}><span>＋</span>Add</button><button><span>▱</span>Documents</button><button><span>•••</span>More</button></nav>; }
function LoadingScreen() { return <div className="loading-screen"><span>Opening your garage…</span></div>; }
function LoadingCards() { return <main className="page"><div className="skeleton heading-skeleton" /><div className="garage-grid"><div className="skeleton card-skeleton" /><div className="skeleton card-skeleton" /></div></main>; }
