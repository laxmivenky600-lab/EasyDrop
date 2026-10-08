import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Link, useLocation } from 'wouter';
import { useCreateTransferSession } from '@workspace/api-client-react';
import { QRCodeSVG } from 'qrcode.react';
import JSZip from 'jszip';
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, CircleAlert,
  Clock3, CloudUpload, FileArchive, FileImage, FileText, LockKeyhole, Menu, Plus, QrCode,
  RefreshCw, ShieldCheck, Smartphone, Upload, Wifi, X,
} from 'lucide-react';
import { useEasyDropSession, type FileMeta } from './use-easydrop-session';

const MAX_FILES = 40;
const MAX_BYTES = 250 * 1024 * 1024;
const queryClient = new QueryClient();
const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const prettyName = (name: string) => name.length > 36 ? `${name.slice(0, 25)}…${name.slice(name.lastIndexOf('.'))}` : name;
const metadata = (file: File): FileMeta => ({ name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size });
const fileIcon = (mime: string) => mime.startsWith('image/') ? FileImage : mime.includes('zip') ? FileArchive : FileText;

function Brand({ inverse = false }: { inverse?: boolean }) {
  return <Link href="/" data-testid="link-easydrop-home" aria-label="EasyDrop home" className={`inline-flex items-center gap-2.5 font-display text-[18px] font-extrabold tracking-[-.7px] ${inverse ? 'text-white' : 'text-[#192843]'}`}>
    <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#315fe4] text-white shadow-[0_7px_17px_rgba(40,85,206,.24)]"><ArrowDownToLine size={18} strokeWidth={2.6} /></span>
    EasyDrop
  </Link>;
}

function Header({ action, nav = false }: { action?: ReactNode; nav?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <header className="relative z-10 border-b border-[#e7ebf2] bg-[#fbfcfe]/90 backdrop-blur-md">
    <div className="mx-auto flex h-[68px] max-w-[1160px] items-center justify-between px-5 sm:px-8">
      <Brand />
      {nav && <nav aria-label="Main navigation" className="hidden items-center gap-6 text-[11px] font-semibold text-[#65738a] md:flex">
        <Link href="/" data-testid="link-nav-home" className="hover:text-[#315fe4]">Home</Link>
        <a href="#how-it-works" data-testid="link-nav-how-it-works" className="hover:text-[#315fe4]">How It Works</a>
        <a href="#features" data-testid="link-nav-features" className="hover:text-[#315fe4]">Features</a>
        <a href="#security" data-testid="link-nav-security" className="hover:text-[#315fe4]">Security</a>
      </nav>}
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="hidden items-center gap-2 text-[11px] font-semibold text-[#77849a] sm:flex"><LockKeyhole size={13} className="text-[#526caa]" />No account. No cloud storage.</div>
        {action}
        {nav && <button type="button" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} data-testid="button-mobile-navigation" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#e2e8f1] text-[#5b6980] hover:bg-[#f2f5fa] md:hidden">
          {menuOpen ? <X size={16} /> : <Menu size={17} />}
        </button>}
      </div>
    </div>
    {nav && menuOpen && <nav aria-label="Mobile navigation" className="absolute left-0 right-0 top-full border-b border-[#e7ebf2] bg-white px-5 py-3 shadow-lg md:hidden">
      <Link href="/" onClick={() => setMenuOpen(false)} data-testid="link-mobile-home" className="block rounded-lg px-3 py-2.5 text-[12px] font-semibold text-[#53627a] hover:bg-[#f5f7fb]">Home</Link>
      <a href="#how-it-works" onClick={() => setMenuOpen(false)} data-testid="link-mobile-how-it-works" className="block rounded-lg px-3 py-2.5 text-[12px] font-semibold text-[#53627a] hover:bg-[#f5f7fb]">How It Works</a>
      <a href="#features" onClick={() => setMenuOpen(false)} data-testid="link-mobile-features" className="block rounded-lg px-3 py-2.5 text-[12px] font-semibold text-[#53627a] hover:bg-[#f5f7fb]">Features</a>
      <a href="#security" onClick={() => setMenuOpen(false)} data-testid="link-mobile-security" className="block rounded-lg px-3 py-2.5 text-[12px] font-semibold text-[#53627a] hover:bg-[#f5f7fb]">Security</a>
    </nav>}
  </header>;
}

function FileRow({ file, onRemove, index }: { file: File; onRemove?: () => void; index: number }) {
  const Icon = fileIcon(file.type);
  return <div data-testid={`file-row-${index}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-[#e5eaf2] bg-white px-3.5 py-3">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-[#eef3ff] text-[#4063c6]"><Icon size={18} /></span>
    <div className="min-w-0 flex-1"><div data-testid={`text-filename-${index}`} title={file.name} className="truncate text-[12px] font-bold text-[#273650]">{prettyName(file.name)}</div><div className="mt-1 text-[10px] font-medium text-[#8792a4]">{formatBytes(file.size)} <span className="mx-1 text-[#c4cbd6]">/</span>{file.type || 'Unknown file type'}</div></div>
    {onRemove && <button onClick={onRemove} aria-label={`Remove ${file.name}`} data-testid={`button-remove-file-${index}`} className="rounded-lg p-2 text-[#8e99aa] transition hover:bg-[#fff1ef] hover:text-[#bd514d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#315fe4]"><X size={15} /></button>}
  </div>;
}

function Home() {
  const [, setLocation] = useLocation();
  const [selected, setSelected] = useState<File[]>([]);
  const [notice, setNotice] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const session = useEasyDropSession();
  const createSession = useCreateTransferSession();
  const totalBytes = useMemo(() => selected.reduce((sum, file) => sum + file.size, 0), [selected]);
  const [sessionData, setSessionData] = useState<{ sessionId: string; senderToken: string; receiverToken: string; expiresAt: string } | null>(null);
  const timeLeft = useExpiryCountdown(session.expiresAt);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const next = Array.from(incoming);
    if (!next.length) return;
    setNotice('');
    const merged = [...selected, ...next];
    const unique = merged.filter((file, index) => merged.findIndex((candidate) => candidate.name === file.name && candidate.size === file.size && candidate.lastModified === file.lastModified) === index);
    if (unique.length > MAX_FILES) {
      setNotice(`EasyDrop supports up to ${MAX_FILES} files in one transfer.`);
      return;
    }
    if (unique.reduce((sum, file) => sum + file.size, 0) > MAX_BYTES) {
      setNotice('The combined file size is over 250 MiB. Remove a file or choose a smaller set.');
      return;
    }
    setSelected(unique);
  }, [selected]);

  const create = () => {
    if (!selected.length) { setNotice('Choose at least one file to make a transfer.'); return; }
    if (totalBytes > MAX_BYTES) { setNotice('The combined file size is over 250 MiB.'); return; }
    setNotice('');
    createSession.mutate({ data: { files: selected.map(metadata) } }, {
      onSuccess: (response) => {
        const next = { sessionId: response.sessionId, senderToken: response.senderToken, receiverToken: response.receiverToken, expiresAt: response.expiresAt };
        setSessionData(next);
        session.connect('sender', response.sessionId, response.senderToken, selected);
      },
      onError: () => setNotice('A temporary session could not be created. Check your connection and try again.'),
    });
  };
  const refresh = () => {
    session.cancel();
    setSessionData(null);
    window.setTimeout(create, 0);
  };
  const end = () => {
    session.cancel();
    setSessionData(null);
  };
  const qrValue = sessionData ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/receiver?sessionId=${encodeURIComponent(sessionData.sessionId)}&key=${encodeURIComponent(sessionData.receiverToken)}` : '';
  const allBytes = totalBytes;
  const progress = allBytes ? Math.min(100, Math.round(session.bytesTransferred / allBytes * 100)) : 0;
  const effectiveStatus = session.status;

  useEffect(() => {
    if (effectiveStatus === 'complete') session.disconnect();
  }, [effectiveStatus, session.disconnect]);

  return <div className="min-h-[100dvh] bg-[#f5f7fb] text-[#1b2942]">
    <Header nav={!sessionData} action={sessionData ? <button onClick={end} data-testid="button-end-session-header" className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[11px] font-bold text-[#68758b] hover:bg-[#edf1f7]"><X size={14} /> End session</button> : <a href="#send" data-testid="link-start-sharing" className="inline-flex items-center gap-1 text-[10px] font-bold text-[#315fe4] sm:gap-1.5 sm:text-[12px]">Create Transfer <ChevronRight size={14} /></a>} />

    {!sessionData ? <main className="page-enter">
      <section className="relative overflow-hidden border-b border-[#e6eaf1] bg-[#fcfdff]">
        <div className="pointer-events-none absolute -right-[270px] -top-[280px] h-[680px] w-[680px] rounded-full border border-[#e4eafa] bg-[radial-gradient(circle_at_center,rgba(221,231,255,.7),rgba(247,249,252,0)_67%)]" />
        <div className="relative mx-auto grid max-w-[1160px] items-center gap-14 px-5 pb-16 pt-16 sm:px-8 md:grid-cols-[1fr_.88fr] md:pb-24 md:pt-24">
          <div className="max-w-[600px]">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#dce5fb] bg-[#f1f5ff] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[1.3px] text-[#3b5da8]"><span className="h-1.5 w-1.5 rounded-full bg-[#4f71d4]" /> QR file sharing</div>
            <h1 className="font-display text-[45px] font-extrabold leading-[1.06] tracking-[-2.8px] text-[#1a2943] sm:text-[61px]">Scan. Send.<br /><span className="text-[#315fe4]">Download.</span></h1>
            <p className="mt-6 max-w-[480px] text-[15px] leading-[1.8] text-[#69768c]">Share files instantly between devices using a simple QR code. No nearby-device searching. No complicated setup.</p>
            <p className="mt-2 max-w-[480px] text-[12px] leading-6 text-[#7d899c]">After the receiver approves, file bytes travel directly between browsers—not through EasyDrop storage.</p>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-[11px] font-semibold text-[#6e7b91]">
              <span className="inline-flex items-center gap-2"><Wifi size={14} className="text-[#3f6ad2]" />Fast transfers</span>
              <span className="inline-flex items-center gap-2"><ShieldCheck size={14} className="text-[#39896b]" />Secure sessions</span>
              <span className="inline-flex items-center gap-2"><Smartphone size={14} className="text-[#3f6ad2]" />Works across devices</span>
              <span className="inline-flex items-center gap-2"><QrCode size={14} className="text-[#3f6ad2]" />No app required</span>
            </div>
            <a href="#send" className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-[#315fe4] px-5 text-[13px] font-bold text-white shadow-[0_10px_22px_rgba(49,95,228,.22)] transition hover:-translate-y-0.5 hover:bg-[#274fcb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315fe4]" data-testid="link-choose-files">Create Transfer <ArrowRight size={16} /></a>
          </div>
          <div className="relative mx-auto w-full max-w-[420px]">
            <div className="absolute -inset-5 rounded-[34px] bg-[#e7edfb] opacity-80 blur-2xl" />
            <div className="relative overflow-hidden rounded-[24px] border border-[#e1e7f1] bg-white p-5 shadow-[0_22px_60px_rgba(28,48,86,.12)] sm:p-6">
              <div className="flex items-center justify-between border-b border-[#edf0f5] pb-4"><div><div className="text-[10px] font-bold uppercase tracking-[1.2px] text-[#8d98a9]">A private handoff</div><div className="mt-1 text-[14px] font-bold">Only the files you choose</div></div><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef3ff] text-[#315fe4]"><LockKeyhole size={17} /></span></div>
              <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="rounded-xl border border-[#e8edf4] bg-[#fafbfd] p-3 text-center"><span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf0ff] text-[#4167cb]"><Upload size={18} /></span><div className="mt-2 text-[10px] font-bold">Select files</div></div>
                <div className="flex items-center gap-1 text-[#a0abc0]"><span className="h-px w-3 bg-[#cbd5e6]" /><QrCode size={18} /><span className="h-px w-3 bg-[#cbd5e6]" /></div>
                <div className="rounded-xl border border-[#e8edf4] bg-[#fafbfd] p-3 text-center"><span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4fb] text-[#506b9b]"><Smartphone size={18} /></span><div className="mt-2 text-[10px] font-bold">Scan to accept</div></div>
              </div>
              <div className="my-5 flex items-center gap-3 text-[9px] font-bold uppercase tracking-[1.15px] text-[#9ba5b5]"><span className="h-px flex-1 bg-[#e9edf3]" />The receiver decides<span className="h-px flex-1 bg-[#e9edf3]" /></div>
              <div className="flex items-center gap-3 rounded-xl border border-[#e8edf4] bg-[#fbfcfe] p-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eff3fc] text-[#4766b4]"><FileText size={16} /></span><div className="flex-1"><div className="text-[11px] font-bold">Selected files stay on your device</div><div className="mt-1 text-[10px] text-[#8691a3]">No permanent public links</div></div><CheckCircle2 size={17} className="text-[#4c6db6]" /></div>
              <div className="mt-4 rounded-lg bg-[#f2f5fb] px-3.5 py-3 text-[10px] leading-[1.7] text-[#718098]"><ShieldCheck size={13} className="mr-1.5 inline text-[#4669bf]" />A short-lived QR carries session credentials—not file contents.</div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-8 border-b border-[#e6eaf1] bg-white px-5 py-16 sm:px-8 md:py-20">
        <div className="mx-auto max-w-[1160px]">
          <div className="max-w-[580px]"><p className="text-[10px] font-bold uppercase tracking-[1.35px] text-[#4968b4]">Simple by design</p><h2 className="font-display mt-3 text-[30px] font-extrabold tracking-[-1.4px] text-[#1e2b44]">Three steps to a clean handoff.</h2><p className="mt-3 text-[13px] leading-6 text-[#748197]">No discovery or device setup. The QR is the connection.</p></div>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {[
              { title: 'Create a transfer', text: 'Choose the files. EasyDrop creates a temporary QR session.', icon: Upload },
              { title: 'Scan and approve', text: 'The receiver scans the code, reviews the file list, and accepts.', icon: QrCode },
              { title: 'Send and download', text: 'Files move peer-to-peer, then the receiver downloads them.', icon: ArrowDownToLine },
            ].map(({ title, text, icon: Icon }, index) => <article key={title} className="rounded-2xl border border-[#e5eaf2] bg-[#fbfcfe] p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf2ff] text-[#4167cb]"><Icon size={18} /></span>
              <div className="mt-5 text-[10px] font-bold uppercase tracking-[1.2px] text-[#8390a5]">0{index + 1}</div><h3 className="mt-1 text-[14px] font-bold text-[#263650]">{title}</h3><p className="mt-2 text-[12px] leading-6 text-[#748197]">{text}</p>
            </article>)}
          </div>
        </div>
      </section>
      <section id="features" className="scroll-mt-8 border-b border-[#e6eaf1] px-5 py-16 sm:px-8 md:py-20">
        <div className="mx-auto grid max-w-[1160px] gap-8 md:grid-cols-[.7fr_1.3fr] md:items-center">
          <div><p className="text-[10px] font-bold uppercase tracking-[1.35px] text-[#4968b4]">Made for the handoff</p><h2 className="font-display mt-3 text-[30px] font-extrabold tracking-[-1.4px] text-[#1e2b44]">Only the files you choose.</h2><p className="mt-3 text-[13px] leading-6 text-[#748197]">Send multiple common file types, confirm the exact list, and let the receiver decide before anything is sent.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#e5eaf2] bg-white p-4"><ShieldCheck size={18} className="text-[#3f6ad2]" /><h3 className="mt-3 text-[13px] font-bold">Receiver approval</h3><p className="mt-1 text-[11px] leading-5 text-[#748197]">No file bytes move until the receiver accepts.</p></div>
            <div className="rounded-xl border border-[#e5eaf2] bg-white p-4"><Wifi size={18} className="text-[#3f6ad2]" /><h3 className="mt-3 text-[13px] font-bold">Direct transfer</h3><p className="mt-1 text-[11px] leading-5 text-[#748197]">WebRTC carries files between the two browsers.</p></div>
            <div className="rounded-xl border border-[#e5eaf2] bg-white p-4"><Clock3 size={18} className="text-[#3f6ad2]" /><h3 className="mt-3 text-[13px] font-bold">Temporary QR</h3><p className="mt-1 text-[11px] leading-5 text-[#748197]">A short session window; no permanent public links.</p></div>
            <div className="rounded-xl border border-[#e5eaf2] bg-white p-4"><Smartphone size={18} className="text-[#3f6ad2]" /><h3 className="mt-3 text-[13px] font-bold">Works across devices</h3><p className="mt-1 text-[11px] leading-5 text-[#748197]">Open the receiver link in a modern browser. No app install.</p></div>
          </div>
        </div>
      </section>
      <section id="security" className="scroll-mt-8 bg-[#eef3fc] px-5 py-16 sm:px-8 md:py-20">
        <div className="mx-auto flex max-w-[1160px] flex-col gap-6 rounded-2xl border border-[#dfe7f5] bg-white p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-[680px]"><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[1.35px] text-[#4968b4]"><LockKeyhole size={14} /> Security, without surprises</p><h2 className="font-display mt-3 text-[27px] font-extrabold tracking-[-1.1px] text-[#1e2b44]">Your files stay yours.</h2><p className="mt-3 text-[12px] leading-6 text-[#748197]">The server handles short-lived pairing and signaling metadata, not file contents. After approval, browser WebRTC encrypts the peer connection; sessions expire automatically and close when the transfer completes.</p></div>
          <a href="#send" data-testid="link-security-create-transfer" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#315fe4] px-4 text-[11px] font-bold text-white hover:bg-[#274fcb]">Create Transfer <ArrowRight size={14} /></a>
        </div>
      </section>

      <section id="send" className="mx-auto max-w-[1160px] scroll-mt-8 px-5 py-16 sm:px-8 md:py-20">
        <div className="grid gap-10 md:grid-cols-[.72fr_1.28fr] md:gap-16">
          <div className="pt-2">
            <div className="text-[10px] font-bold uppercase tracking-[1.35px] text-[#4968b4]">Start a transfer</div>
            <h2 className="font-display mt-3 text-[29px] font-extrabold leading-tight tracking-[-1.4px] text-[#1e2b44]">Pick what goes.<br />Nothing else.</h2>
            <p className="mt-3 max-w-[320px] text-[12px] leading-6 text-[#748197]">Choose up to 40 files, 250 MiB total. You’ll review the files again before any bytes are sent.</p>
            <div className="mt-6 space-y-3 text-[11px] leading-5 text-[#6c7a91]">
              <div className="flex gap-2.5"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#e9efff] text-[#4163bd]"><Check size={12} /></span>Receiver sees exact names and sizes before accepting.</div>
              <div className="flex gap-2.5"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#e9efff] text-[#4163bd]"><Check size={12} /></span>Transfer uses a direct WebRTC data channel.</div>
              <div className="flex gap-2.5"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#e9efff] text-[#4163bd]"><Check size={12} /></span>Session expires automatically; no account or history.</div>
            </div>
          </div>
          <div className="rounded-[22px] border border-[#e1e7f0] bg-[#fbfcfe] p-4 shadow-[0_12px_38px_rgba(33,53,91,.05)] sm:p-6">
            <div className={`group rounded-[16px] border border-dashed px-5 py-8 text-center transition ${dragging ? 'border-[#315fe4] bg-[#f0f4ff]' : 'border-[#cdd7e7] bg-white hover:border-[#8ea7e5] hover:bg-[#fcfdff]'}`}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}>
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#edf2ff] text-[#3d64ca]"><CloudUpload size={22} /></span>
              <h3 className="mt-3 text-[13px] font-bold text-[#26354f]">Drop files here</h3>
              <p className="mt-1 text-[11px] text-[#8590a2]">or browse from this device</p>
              <button type="button" onClick={() => inputRef.current?.click()} data-testid="button-browse-files" className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-[#dce3ee] bg-white px-3.5 text-[11px] font-bold text-[#475a7d] transition hover:border-[#bac9eb] hover:text-[#315fe4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#315fe4]"><Plus size={14} /> Browse files</button>
              <input ref={inputRef} type="file" multiple className="sr-only-focusable" aria-label="Choose files to send" data-testid="input-files" onChange={(event) => { if (event.currentTarget.files) addFiles(event.currentTarget.files); event.currentTarget.value = ''; }} />
            </div>
            <div className="mt-4 flex items-center justify-between text-[10px] font-semibold text-[#8a95a7]"><span>Up to 40 files</span><span>250 MiB total</span></div>
            {selected.length > 0 && <div className="mt-5">
              <div className="mb-2.5 flex items-center justify-between"><h3 className="text-[11px] font-bold text-[#34445f]">{selected.length} {selected.length === 1 ? 'file' : 'files'} selected</h3><span className={`text-[10px] font-semibold ${totalBytes > MAX_BYTES ? 'text-[#b84b48]' : 'text-[#77849a]'}`}>{formatBytes(totalBytes)} / 250 MiB</span></div>
              <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">{selected.map((file, index) => <FileRow key={`${file.name}-${file.lastModified}-${index}`} file={file} index={index} onRemove={() => setSelected((items) => items.filter((_, i) => i !== index))} />)}</div>
            </div>}
            {notice && <p role="alert" data-testid="status-upload-error" className="mt-4 flex items-start gap-2 rounded-lg border border-[#f0d7d3] bg-[#fff7f5] p-3 text-[11px] leading-5 text-[#a54c47]"><CircleAlert size={15} className="mt-0.5 shrink-0" />{notice}</p>}
            {createSession.isError && <p role="alert" data-testid="status-session-create-error" className="mt-3 text-[11px] text-[#a54c47]">Could not reach the session service. Your files remain on this device.</p>}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[10px] text-[#8994a6]">File bytes never upload to EasyDrop.</span>
              <button onClick={create} disabled={!selected.length || createSession.isPending} data-testid="button-create-session" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#315fe4] px-5 text-[12px] font-bold text-white shadow-[0_7px_16px_rgba(49,95,228,.18)] transition hover:bg-[#274fcb] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315fe4]">{createSession.isPending ? <><span className="h-4 w-4 animate-pulse rounded-full border-2 border-white/40 border-t-white" />Creating secure QR…</> : <>Create temporary QR <ArrowRight size={15} /></>}</button>
            </div>
          </div>
        </div>
      </section>
      <section className="border-y border-[#e5eaf2] bg-[#eef2f9]">
        <div className="mx-auto grid max-w-[1160px] gap-8 px-5 py-10 sm:px-8 md:grid-cols-[.75fr_1.25fr] md:items-center">
          <div><div className="text-[10px] font-bold uppercase tracking-[1.25px] text-[#526cae]">How EasyDrop works</div><h2 className="font-display mt-2 text-[22px] font-extrabold tracking-[-.8px]">Consent first. Bytes second.</h2></div>
          <div className="grid gap-4 sm:grid-cols-3">{[['01', 'Choose', 'Select and preview your files.'], ['02', 'Scan & accept', 'The receiver checks metadata and approves.'], ['03', 'Send direct', 'A live peer channel moves the file bytes.']].map(([n, title, copy]) => <div key={n} className="flex gap-3"><span className="font-display text-[11px] font-extrabold text-[#5270bb]">{n}</span><div><div className="text-[11px] font-bold">{title}</div><p className="mt-1 text-[10px] leading-5 text-[#77849a]">{copy}</p></div></div>)}</div>
        </div>
      </section>
      <footer className="mx-auto flex max-w-[1160px] flex-col gap-2 px-5 py-6 text-[10px] text-[#8994a5] sm:flex-row sm:items-center sm:justify-between sm:px-8"><Brand /><span>Temporary QR access. Peer-to-peer file bytes. No saved transfer history.</span><a href="#send" className="font-bold text-[#536b9f] hover:text-[#315fe4]" data-testid="link-back-to-upload">Back to files</a></footer>
    </main> : <main className="page-enter mx-auto min-h-[calc(100dvh-68px)] max-w-[1080px] px-4 pb-14 pt-7 sm:px-7 sm:pt-10">
      <div className="mx-auto max-w-[850px]">
        <div className="mb-7 flex items-center justify-between">
          <button onClick={end} data-testid="button-end-session" className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-[11px] font-bold text-[#6f7d92] hover:bg-[#e9edf4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#315fe4]"><ArrowLeft size={14} /> End session</button>
          {session.status !== 'complete' && <div data-testid="status-session-countdown" className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold tabular-nums ${timeLeft === '00:00' ? 'bg-[#fff0ee] text-[#ae4d46]' : 'bg-[#edf2fc] text-[#5e7094]'}`}><Clock3 size={12} />{timeLeft === '00:00' ? 'Expired' : `Expires in ${timeLeft}`}</div>}
        </div>
        <div className="mb-8 grid grid-cols-3">
          {['Create QR', 'Receiver approval', 'Send files'].map((label, index) => {
            const active = index === 0 ? ['waiting', 'connecting', 'error'].includes(session.status) : index === 1 ? ['accepted', 'connecting-peer'].includes(session.status) : ['ready', 'transferring', 'complete'].includes(session.status);
            const done = index === 0 ? ['accepted', 'connecting-peer', 'ready', 'transferring', 'complete'].includes(session.status) : index === 1 ? ['ready', 'transferring', 'complete'].includes(session.status) : session.status === 'complete';
            return <div key={label} className="relative flex flex-col items-center gap-2 text-center">
              {index < 2 && <span className={`absolute left-[57%] top-[14px] h-px w-[86%] ${done ? 'bg-[#8da8e8]' : 'bg-[#dce2ec]'}`} />}
              <span className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold ${done ? 'border-[#315fe4] bg-[#315fe4] text-white' : active ? 'border-[#315fe4] bg-white text-[#315fe4] ring-4 ring-[#e8edfb]' : 'border-[#d8dfeb] bg-[#f8f9fc] text-[#9ba6b6]'}`}>{done ? <Check size={13} /> : `0${index + 1}`}</span>
              <span className={`text-[9px] font-bold sm:text-[10px] ${active || done ? 'text-[#4764a9]' : 'text-[#9aa4b3]'}`}>{label}</span>
            </div>;
          })}
        </div>

        {session.status === 'complete' ? <section className="rise-in mx-auto max-w-[600px] rounded-[22px] border border-[#dfe7e4] bg-white px-6 py-10 text-center shadow-[0_12px_40px_rgba(29,49,84,.05)] sm:px-10">
          <div className="success-mark mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f5ef] text-[#26855f]"><Check size={29} strokeWidth={2.5} /></div>
          <div className="mt-5 text-[10px] font-bold uppercase tracking-[1.3px] text-[#398467]">Peer transfer verified</div><h1 className="font-display mt-2 text-[27px] font-extrabold tracking-[-1px]">Transfer complete.</h1>
          <p className="mx-auto mt-2 max-w-[390px] text-[12px] leading-6 text-[#748198]">Every selected byte was sent through the live data channel and acknowledged by the receiver. This temporary session has ended.</p>
          <div className="mx-auto mt-6 max-w-[390px] divide-y divide-[#edf0f4] rounded-xl border border-[#e8edf3] bg-[#fafbfd] text-left">{selected.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-3 px-3.5 py-3"><CheckCircle2 size={16} className="text-[#3f916b]" /><span className="min-w-0 flex-1 truncate text-[11px] font-bold">{file.name}</span><span className="text-[10px] text-[#7f8b9e]">{formatBytes(file.size)} sent</span></div>)}</div>
          <div className="mt-7"><button onClick={() => { setSelected([]); setSessionData(null); session.setStatus('idle'); }} data-testid="button-new-transfer" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#315fe4] px-5 text-[12px] font-bold text-white hover:bg-[#274fcb]">Send more files <ArrowRight size={15} /></button></div>
        </section> : <section className="rise-in grid gap-6 rounded-[22px] border border-[#e1e7f0] bg-white p-5 shadow-[0_12px_40px_rgba(29,49,84,.05)] sm:grid-cols-[1fr_280px] sm:items-center sm:p-8">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[1.2px] text-[#4967b0]"><span className={`h-1.5 w-1.5 rounded-full ${['error','expired','declined','cancelled','disconnected'].includes(session.status) ? 'bg-[#c86259]' : 'bg-[#5076dc]'}`} />{['waiting', 'connecting'].includes(session.status) ? 'Temporary session created' : session.status === 'ready' ? 'Connection verified' : session.status === 'transferring' ? 'Sending file bytes' : 'Temporary handoff'}</div>
            <h1 className="font-display text-[27px] font-extrabold tracking-[-1.2px]">{session.status === 'ready' ? 'Ready to send?' : session.status === 'transferring' ? 'Sending peer to peer.' : session.status === 'accepted' || session.status === 'connecting-peer' ? 'Connecting directly…' : session.status === 'declined' ? 'Transfer declined' : session.status === 'expired' ? 'QR session expired' : session.status === 'disconnected' || session.status === 'error' ? 'Connection interrupted' : 'Scan. Review. Accept.'}</h1>
            <p className="mt-2 max-w-[440px] text-[12px] leading-6 text-[#758198]">{session.status === 'ready' ? 'The receiver accepted, and the peer-to-peer data channel is live. Review the files once more before you send.' : session.status === 'transferring' ? 'Real bytes are moving over the WebRTC data channel. You can stop at any time.' : session.status === 'accepted' || session.status === 'connecting-peer' ? 'Receiver consent is recorded. Establishing the direct data channel now; no bytes have been sent yet.' : 'Show this temporary QR to the receiver. They scan it with their camera, review your file list, then choose whether to accept.'}</p>
            {session.peerPresent && <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#e1e8f1] bg-[#f8fafc] px-3 py-2 text-[10px] font-semibold text-[#566680]"><span className="h-1.5 w-1.5 rounded-full bg-[#4b75d7]" />Receiver is connected to the session</div>}
            <div className="mt-5 space-y-2">{selected.map((file, index) => {
              const sent = session.fileProgress[index] ?? 0;
              const Icon = fileIcon(file.type);
              return <div key={`${file.name}-${file.lastModified}`} className="flex items-center gap-3 rounded-lg border border-[#e8edf3] bg-[#fbfcfe] px-3 py-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#edf2ff] text-[#4665bf]"><Icon size={15} /></span><span className="min-w-0 flex-1 truncate text-[11px] font-bold">{file.name}</span><span className="text-[10px] tabular-nums text-[#7f8b9d]">{session.status === 'transferring' ? `${formatBytes(sent)} / ${formatBytes(file.size)}` : formatBytes(file.size)}</span>{session.status === 'complete' && <CheckCircle2 size={15} className="text-[#398b67]" />}</div>;
            })}</div>
            {session.status === 'transferring' && <div className="mt-4"><div className="mb-2 flex justify-between text-[10px] font-semibold text-[#697790]"><span>Actual bytes sent</span><span>{formatBytes(session.bytesTransferred)} / {formatBytes(allBytes)}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#e8edf5]"><div className="h-full rounded-full bg-[#4169d5]" style={{ width: `${progress}%` }} /></div></div>}
            {session.error && <div role="alert" data-testid="status-transfer-error" className="mt-4 flex gap-2 rounded-lg border border-[#efd9d6] bg-[#fff8f6] p-3 text-[11px] leading-5 text-[#a34e49]"><CircleAlert size={15} className="mt-0.5 shrink-0" />{session.error}</div>}
            <div className="mt-5 flex flex-wrap gap-2">
              {session.status === 'ready' && <button onClick={session.startTransfer} data-testid="button-send-files" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#315fe4] px-4 text-[12px] font-bold text-white hover:bg-[#274fcb]"><ArrowDownToLine size={15} /> Send {selected.length} {selected.length === 1 ? 'file' : 'files'}</button>}
              {['error', 'disconnected'].includes(session.status) && <button onClick={refresh} data-testid="button-retry-session" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#315fe4] px-4 text-[12px] font-bold text-white hover:bg-[#274fcb]"><RefreshCw size={14} /> Create a new QR</button>}
              {['waiting', 'connecting', 'accepted', 'connecting-peer', 'ready', 'transferring'].includes(session.status) && <button onClick={end} data-testid="button-cancel-transfer" className="min-h-11 rounded-lg border border-[#dde4ed] px-4 text-[11px] font-bold text-[#66748a] hover:bg-[#f6f8fb]">{session.status === 'transferring' ? 'Cancel transfer' : 'Cancel session'}</button>}
              {session.status === 'declined' && <button onClick={refresh} data-testid="button-start-new-session" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#315fe4] px-4 text-[12px] font-bold text-white hover:bg-[#274fcb]">Start another session <ArrowRight size={14} /></button>}
              {session.status === 'expired' && <button onClick={refresh} data-testid="button-refresh-expired-session" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#315fe4] px-4 text-[12px] font-bold text-white hover:bg-[#274fcb]"><RefreshCw size={14} /> Create a new QR</button>}
            </div>
            <p className="mt-4 flex items-start gap-2 border-t border-[#edf0f4] pt-3 text-[10px] leading-5 text-[#8792a4]"><ShieldCheck size={13} className="mt-0.5 shrink-0 text-[#5371b8]" />The session API carries file metadata only. Your selected file bytes stay in this browser until a direct peer transfer is established.</p>
          </div>
          <div className="mx-auto w-full max-w-[260px]">
            <div className="rounded-[20px] border border-[#e4eaf2] bg-[#fafbfd] p-4">
              <div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[1px] text-[#8390a3]">Temporary QR</span><span className="rounded-full bg-[#eaf0ff] px-2 py-1 text-[9px] font-bold text-[#5069ab]">One session</span></div>
              <div className="rounded-[13px] border border-[#e7ecf3] bg-white p-3">{qrValue && <QRCodeSVG value={qrValue} size={216} level="M" marginSize={2} bgColor="#ffffff" fgColor="#182844" className="aspect-square w-full" title="EasyDrop temporary receiver QR code" data-testid="img-session-qr" />}</div>
              <div className="mt-3 text-center text-[10px] leading-5 text-[#79869a]">{timeLeft === '00:00' ? 'This session has expired' : 'Scan using the other device’s camera'}</div>
            </div>
            <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-[#8691a4]"><Smartphone size={13} />Opens the receiver page in browser</div>
          </div>
        </section>}
      </div>
    </main>}
  </div>;
}

function useExpiryCountdown(expiresAt: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!expiresAt) return '--:--';
  const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function Receiver() {
  const [, setLocation] = useLocation();
  const session = useEasyDropSession();
  const [zipBusy, setZipBusy] = useState(false);
  const [zipError, setZipError] = useState('');
  const started = useRef(false);
  const timeLeft = useExpiryCountdown(session.expiresAt);
  const receivedBytes = useMemo(() => session.files.reduce((sum, file) => sum + file.size, 0), [session.files]);
  const completeBytes = useMemo(() => session.receivedFiles.reduce((sum, file) => sum + file.size, 0), [session.receivedFiles]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('sessionId');
    const token = params.get('key');
    window.history.replaceState(window.history.state, '', window.location.pathname);
    if (!sessionId || !token) {
      session.setStatus('error');
      return;
    }
    if (!started.current) {
      started.current = true;
      session.connect('receiver', sessionId, token);
    }
  }, [session.connect, session.setStatus]);
  useEffect(() => {
    if (session.status === 'complete') session.disconnect();
  }, [session.status, session.disconnect]);

  const downloadAll = async () => {
    if (session.receivedFiles.length !== session.files.length || session.receivedFiles.length === 0) {
      setZipError('All files must be received before creating the ZIP.');
      return;
    }
    setZipBusy(true);
    setZipError('');
    try {
      const zip = new JSZip();
      const usedNames = new Set<string>();
      session.receivedFiles.forEach((file) => {
        let archiveName = file.name;
        let suffix = 2;
        while (usedNames.has(archiveName)) {
          const dot = file.name.lastIndexOf('.');
          archiveName = dot > 0 ? `${file.name.slice(0, dot)} (${suffix})${file.name.slice(dot)}` : `${file.name} (${suffix})`;
          suffix += 1;
        }
        usedNames.add(archiveName);
        zip.file(archiveName, file.blob);
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'easydrop-files.zip';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch {
      setZipError('The ZIP could not be prepared. Download each completed file individually.');
    } finally {
      setZipBusy(false);
    }
  };
  const status = session.status;
  const received = status === 'complete';
  const canConsent = ['waiting'].includes(status) && session.files.length > 0;

  return <div className="min-h-[100dvh] bg-[#f5f7fb] text-[#1b2942]">
    <Header action={<span className="inline-flex items-center gap-1.5 rounded-full border border-[#e2e8f1] bg-white px-3 py-1.5 text-[10px] font-semibold text-[#708098]"><LockKeyhole size={12} className="text-[#526cae]" />Private session</span>} />
    <main className="page-enter mx-auto min-h-[calc(100dvh-68px)] max-w-[900px] px-4 pb-16 pt-8 sm:px-7 sm:pt-12">
      <div className="mx-auto max-w-[660px]">
        {!received && <div className="mb-7 flex items-center justify-between"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[1.1px] text-[#5c6d8c]"><span className={`h-1.5 w-1.5 rounded-full ${['error','expired','cancelled','declined'].includes(status) ? 'bg-[#bc5c55]' : 'bg-[#5478d7]'}`} />{status === 'waiting' ? 'Awaiting your decision' : status === 'ready' || status === 'transferring' ? 'Transfer in progress' : 'Temporary file request'}</div><span data-testid="status-receiver-expiry" className="inline-flex items-center gap-1.5 text-[10px] font-semibold tabular-nums text-[#7d899c]"><Clock3 size={12} />{timeLeft}</span></div>}
        {received ? <section className="rise-in rounded-[22px] border border-[#dfe8e2] bg-white p-6 shadow-[0_12px_40px_rgba(29,49,84,.05)] sm:p-9">
          <div className="flex flex-col items-center text-center">
            <div className="success-mark flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f5ef] text-[#26855f]"><Check size={29} strokeWidth={2.5} /></div>
            <div className="mt-5 text-[10px] font-bold uppercase tracking-[1.3px] text-[#398467]">Transfer verified</div>
            <h1 className="font-display mt-2 text-[28px] font-extrabold tracking-[-1px]">Your files are ready.</h1>
            <p data-testid="status-files-ready" className="mt-2 max-w-[400px] text-[12px] leading-6 text-[#748198]">All {session.receivedFiles.length} files arrived over the direct peer connection. Save them to this device now.</p>
          </div>
          <div className="mt-7 divide-y divide-[#edf0f4] rounded-xl border border-[#e6ebf2] bg-[#fbfcfe]">{session.receivedFiles.map((file, index) => {
            const Icon = fileIcon(file.mimeType);
            return <div key={`${file.name}-${file.size}`} data-testid={`received-file-${index}`} className="flex flex-wrap items-center gap-3 px-3.5 py-3.5 sm:flex-nowrap">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#edf3ff] text-[#4867be]"><Icon size={16} /></span>
              <div className="min-w-0 flex-1"><div className="truncate text-[11px] font-bold text-[#2e3d57]">{file.name}</div><div className="mt-1 text-[10px] text-[#8290a3]">{formatBytes(file.size)} · {file.mimeType}</div></div>
              <a href={file.url} download={file.name} data-testid={`link-download-file-${index}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#dce4f0] bg-white px-3 text-[10px] font-bold text-[#405a98] hover:border-[#a9bce9] hover:bg-[#f8faff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#315fe4]"><ArrowDownToLine size={13} /> Download</a>
            </div>;
          })}</div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-[10px] text-[#828ea0]">{formatBytes(completeBytes)} received · files stay on this device</span><button onClick={downloadAll} disabled={zipBusy} data-testid="button-download-all" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#315fe4] px-4 text-[11px] font-bold text-white hover:bg-[#274fcb] disabled:opacity-60"><FileArchive size={15} />{zipBusy ? 'Preparing ZIP…' : 'Download all as ZIP'}</button></div>
          {zipError && <p role="alert" data-testid="status-zip-error" className="mt-3 text-[11px] text-[#a34e49]">{zipError}</p>}
          <p className="mt-6 border-t border-[#edf0f4] pt-4 text-center text-[10px] leading-5 text-[#8994a4]">The sender’s temporary session has ended. This page has no permanent file link.</p>
        </section> : <section className="rise-in rounded-[22px] border border-[#e1e7f0] bg-white p-5 shadow-[0_12px_40px_rgba(29,49,84,.05)] sm:p-8">
          <div className="mb-6 flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#edf2ff] text-[#4265c4]"><QrCode size={21} /></span><div><div className="text-[10px] font-bold uppercase tracking-[1.15px] text-[#526cad]">EasyDrop file request</div><h1 className="font-display mt-1 text-[25px] font-extrabold tracking-[-1px]">{status === 'expired' ? 'This QR has expired' : status === 'declined' ? 'Request declined' : status === 'cancelled' ? 'Session ended' : ['error','disconnected'].includes(status) ? 'Could not connect' : status === 'transferring' ? 'Receiving files…' : 'Review before accepting'}</h1></div></div>
          <p className="mb-5 max-w-[520px] text-[12px] leading-6 text-[#758198]">{status === 'waiting' ? 'The sender has not received an acceptance yet. Check these exact file details before deciding. No bytes move until you accept and the direct connection is ready.' : status === 'accepted' || status === 'connecting-peer' ? 'You accepted. Establishing the peer-to-peer data channel; files will only become available after all bytes arrive.' : status === 'ready' || status === 'transferring' ? 'The sender is sending bytes over WebRTC. Keep this page open until every file is assembled.' : session.error || 'Connecting to the temporary session…'}</p>
          {session.files.length > 0 ? <div className="divide-y divide-[#edf0f4] rounded-xl border border-[#e6ebf2] bg-[#fbfcfe]">{session.files.map((file, index) => {
            const Icon = fileIcon(file.mimeType);
            const currentBytes = session.fileProgress[index] ?? 0;
            return <div key={`${file.name}-${index}`} data-testid={`requested-file-${index}`} className="flex items-center gap-3 px-3.5 py-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#edf2ff] text-[#4966b6]"><Icon size={16} /></span><div className="min-w-0 flex-1"><div className="truncate text-[11px] font-bold text-[#2d3c56]">{file.name}</div><div className="mt-1 text-[10px] text-[#8390a2]">{file.mimeType} <span className="mx-1 text-[#c4cbd5]">·</span>{formatBytes(file.size)}</div></div>{['transferring','ready'].includes(status) && <span className="text-[10px] font-semibold tabular-nums text-[#71809a]">{status === 'transferring' ? `${formatBytes(currentBytes)} / ${formatBytes(file.size)}` : 'Waiting'}</span>}</div>;
          })}</div> : status === 'connecting' || status === 'waiting' ? <div className="space-y-2.5 rounded-xl border border-[#e6ebf2] bg-[#fbfcfe] p-4">{[0,1,2].map((item) => <div key={item} className="h-10 animate-pulse rounded-lg bg-[#edf1f7]" />)}</div> : <div className="rounded-xl border border-dashed border-[#d8e0ec] bg-[#fafbfd] px-4 py-7 text-center text-[11px] leading-5 text-[#8792a4]">File metadata is unavailable. Ask the sender to create a new QR session.</div>}
          {session.error && !['expired','declined','cancelled'].includes(status) && <div role="alert" data-testid="status-receiver-error" className="mt-4 flex gap-2 rounded-lg border border-[#efd9d6] bg-[#fff8f6] p-3 text-[11px] leading-5 text-[#a34e49]"><CircleAlert size={15} className="mt-0.5 shrink-0" />{session.error}</div>}
          {['transferring','ready'].includes(status) && <div className="mt-5"><div className="mb-2 flex justify-between text-[10px] font-semibold text-[#697790]"><span>Actual bytes received</span><span>{formatBytes(session.bytesTransferred)} / {formatBytes(receivedBytes)}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#e8edf5]"><div className="h-full rounded-full bg-[#4169d5]" style={{ width: `${receivedBytes ? Math.min(100, session.bytesTransferred / receivedBytes * 100) : 0}%` }} /></div></div>}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {canConsent && <button onClick={session.decline} data-testid="button-decline-transfer" className="min-h-11 rounded-lg border border-[#dce3ec] px-5 text-[11px] font-bold text-[#64728a] hover:bg-[#f7f9fc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#315fe4]">Decline</button>}
            {canConsent && <button onClick={session.accept} data-testid="button-accept-transfer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#315fe4] px-5 text-[11px] font-bold text-white hover:bg-[#274fcb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315fe4]">Accept files <ArrowRight size={14} /></button>}
            {['error','disconnected'].includes(status) && <button onClick={session.retryConnection} data-testid="button-retry-receiver" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#315fe4] px-5 text-[11px] font-bold text-white hover:bg-[#274fcb]"><RefreshCw size={14} /> Retry connection</button>}
            {['expired','cancelled','declined'].includes(status) && <button onClick={() => setLocation('/')} data-testid="button-return-home" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#315fe4] px-5 text-[11px] font-bold text-white hover:bg-[#274fcb]">Return to EasyDrop <ArrowRight size={14} /></button>}
          </div>
          {status === 'waiting' && <div className="mt-5 flex items-start gap-2 border-t border-[#edf0f4] pt-4 text-[10px] leading-5 text-[#8792a4]"><ShieldCheck size={13} className="mt-0.5 shrink-0 text-[#5875bb]" />Accepting allows a direct peer connection. Your approval is required before file bytes are sent.</div>}
        </section>}
      </div>
    </main>
  </div>;
}

function NotFound() {
  return <div className="grid min-h-[100dvh] place-items-center bg-[#f5f7fb] p-6 text-center"><div><Brand /><h1 className="font-display mt-8 text-3xl font-extrabold">This page isn’t here.</h1><p className="mt-2 text-sm text-[#77849a]">Temporary QR links are only available for a short time.</p><Link href="/" data-testid="link-not-found-home" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#315fe4] px-4 py-2.5 text-sm font-bold text-white"><ArrowLeft size={15} /> Back to EasyDrop</Link></div></div>;
}

function App() {
  return <QueryClientProvider client={queryClient}>
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/receiver" component={Receiver} />
      <Route component={NotFound} />
    </Switch>
  </QueryClientProvider>;
}

export default App;
