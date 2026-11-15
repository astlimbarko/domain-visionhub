import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ClipboardCheck,
  Heart,
  House,
  LayoutGrid,
  MapPin,
  Moon,
  ReceiptText,
  Sun,
  UserRound,
  Users,
} from "lucide-react";
import {
  useCargoVigenteCdp,
  useCdpPerfil,
  useDomicilioCdp,
} from "@/hooks/useCasasDePaz";
import { useFotoPerfilPath, useUrlFotoPerfil } from "@/hooks/usePersonaFoto";
import { useAuthStore } from "@/store/auth.store";
import { iniciales } from "@/components/shared/AvatarIniciales";
import { ROUTES } from "@/utils/constants";
import { AppearanceContext } from "../appearance-context";
import { LeaderMobileMenuContext } from "./menu-context";
import styles from "./mobile-cdp.css?inline";

const shortcuts = [
  { id: "reporte", title: "Reporte Casa de Paz", Icon: House },
  { id: "asistencia", title: "Asistencia", Icon: ClipboardCheck },
  { id: "evangelismo", title: "Evangelismo", Icon: Users },
  { id: "papeletas", title: "Papeletas", Icon: ReceiptText },
] as const;
const weekdays = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

function NetworkLogo() {
  return (
    <span className="network-logo">
      <img src="/mobile-cdp/network-emblem.png" alt="" />
    </span>
  );
}

export function LeaderMobileHome({
  cdpId,
  networkName,
  networkColor,
}: {
  cdpId: string;
  networkName: string | null;
  networkColor: string | null;
}) {
  const navigate = useNavigate();
  const appearance = useContext(AppearanceContext);
  const openMenu = useContext(LeaderMobileMenuContext);
  const {
    data: leaders,
    isLoading,
    isError,
    refetch,
  } = useCargoVigenteCdp(cdpId, "LIDER_CDP");
  const { data: details } = useCdpPerfil(cdpId);
  const { data: address } = useDomicilioCdp(cdpId);
  const leader = leaders?.[0];
  const { data: photoPath } = useFotoPerfilPath(leader?.persona_id);
  const { data: photoUrl } = useUrlFotoPerfil(photoPath);
  const personaId = useAuthStore((state) => state.personaId);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const [shadow, setShadow] = useState<ShadowRoot | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const attachHost = useCallback((node: HTMLDivElement | null) => {
    if (node) setShadow(node.shadowRoot ?? node.attachShadow({ mode: "open" }));
  }, []);
  const dark = appearance?.mode === "dark";
  const name =
    leader?.nombre_completo ||
    (isLoading
      ? "Cargando líder…"
      : isError
        ? "No se pudo cargar el líder"
        : "Líder sin asignar");
  const profile = {
    photoUrl,
    address:
      [address?.calle, address?.numero].filter(Boolean).join(" ") ||
      address?.referencia ||
      "Dirección sin registrar",
    networkName: (
      details?.red_nombre ||
      networkName ||
      "Sin red asignada"
    ).replace(/^red\s+/i, ""),
    networkColor:
      networkColor && /^#[0-9a-f]{6}$/i.test(networkColor)
        ? networkColor
        : "#65758b",
  };
  const day =
    details?.dia_reunion != null
      ? weekdays[details.dia_reunion]
      : "Día por definir";
  const meetingTime = details?.hora_reunion?.slice(0, 5);
  const formattedTime =
    meetingTime && /^\d{2}:\d{2}$/.test(meetingTime)
      ? new Intl.DateTimeFormat("es-BO", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }).format(new Date(`2000-01-01T${meetingTime}:00`))
      : "Hora por definir";

  useEffect(() => {
    if (!shadow) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    function updateBottom() {
      if (!viewport) return;
      const gap = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );
      surfaceRef.current?.style.setProperty("--visual-bottom-gap", `${gap}px`);
    }
    updateBottom();
    viewport.addEventListener("resize", updateBottom);
    viewport.addEventListener("scroll", updateBottom);
    window.addEventListener("resize", updateBottom);
    return () => {
      viewport.removeEventListener("resize", updateBottom);
      viewport.removeEventListener("scroll", updateBottom);
      window.removeEventListener("resize", updateBottom);
    };
  }, [shadow]);

  function open(destination: string | null) {
    if (destination === "menu") {
      openMenu?.(menuButtonRef.current);
      return;
    }
    const paths: Record<string, string> = {
      reporte: ROUTES.REPORTES,
      asistencia: ROUTES.HISTORIAL_ASISTENCIA,
      evangelismo: ROUTES.EVANGELISMO,
      calendario: ROUTES.CALENDARIO,
      perfil:
        leader?.persona_id === personaId ? ROUTES.CUENTA : ROUTES.CASAS_DE_PAZ,
    };
    navigate(
      destination ? (paths[destination] ?? ROUTES.DASHBOARD) : ROUTES.DASHBOARD,
      { state: { casaDePazId: cdpId } },
    );
  }

  return (
    <div ref={attachHost} data-leader-mobile-host="true">
      {shadow &&
        createPortal(
          <>
            <style>{styles}</style>
            <div
              className="cdp-app"
              data-theme={dark ? "dark" : "light"}
              ref={surfaceRef}
            >
              <header className="cdp-header">
                <div className="cdp-brand">
                  <span className="brand-art">
                    <img
                      className="brand-image"
                      src="/mobile-cdp/casas-paz-logo-light.png"
                      alt="Casas de Paz"
                    />
                    {dark && (
                      <img
                        className="brand-light-letters"
                        src="/mobile-cdp/casas-paz-logo-light.png"
                        alt=""
                        aria-hidden="true"
                      />
                    )}
                  </span>
                </div>
                <button
                  className="theme-switch"
                  type="button"
                  onClick={() => appearance?.toggle()}
                  aria-label={
                    dark ? "Activar modo claro" : "Activar modo oscuro"
                  }
                  aria-pressed={dark}
                >
                  <span className={!dark ? "active" : ""}>
                    <Sun aria-hidden="true" />
                  </span>
                  <span className={dark ? "active" : ""}>
                    <Moon aria-hidden="true" />
                  </span>
                </button>
              </header>

              <main className="cdp-main">
                <section
                  className="identity"
                  aria-label="Perfil de Casa de Paz"
                >
                  <div className="identity-hero">
                    <svg
                      className="hero-crop"
                      width="0"
                      height="0"
                      aria-hidden="true"
                    >
                      <defs>
                        <clipPath
                          id="hero-clean-edge"
                          clipPathUnits="objectBoundingBox"
                        >
                          <path d="M0 0H1V.63C.66 .48 .30 .64 0 .96Z" />
                        </clipPath>
                      </defs>
                    </svg>
                    <div className="identity-person">
                      <button
                        className="profile-avatar"
                        onClick={() => open("perfil")}
                        aria-label={`Ver perfil de ${name}`}
                      >
                        <span className="avatar-fallback">
                          {iniciales(name) || <UserRound />}
                        </span>
                        {profile.photoUrl &&
                          failedPhoto !== profile.photoUrl && (
                            <img
                              src={profile.photoUrl}
                              alt=""
                              onError={() =>
                                setFailedPhoto(profile.photoUrl ?? null)
                              }
                            />
                          )}
                        <span
                          className="network-color"
                          style={{ backgroundColor: profile.networkColor }}
                          aria-label={`Color de la red ${profile.networkName}`}
                        />
                      </button>
                      <div className="identity-details">
                        <h1>{name}</h1>
                        {isError && (
                          <button type="button" onClick={() => refetch()}>
                            Reintentar cargar líder
                          </button>
                        )}
                        <div className="identity-meta">
                          <span
                            className="identity-address"
                            title={profile.address}
                          >
                            <MapPin aria-hidden="true" />
                            <span className="address-text">
                              {profile.address}
                            </span>
                          </span>
                          <span>
                            <CalendarDays aria-hidden="true" />
                            {day}, {formattedTime}
                          </span>
                        </div>
                      </div>
                    </div>
                    <img
                      className="hero-ribbon"
                      src="/mobile-cdp/hero-ribbon-v3.png"
                      alt=""
                    />
                  </div>
                  <div className="network-signature">
                    <NetworkLogo />
                    <div className="network-wordmark">
                      <span>RED</span>
                      <strong style={{ color: dark ? "#f1f5ff" : "#073bc3" }}>
                        {profile.networkName}
                      </strong>
                      <svg
                        viewBox="0 0 120 16"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M2 8 Q12 -2 22 8 T42 8 T62 8 T82 8 T102 8 T118 8"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  </div>
                </section>

                <section
                  className="access-section"
                  aria-labelledby="access-title"
                >
                  <div className="access-heading">
                    <h2 id="access-title">Acceso Rápido</h2>
                    <p>Accede a las funciones principales</p>
                  </div>
                  <nav
                    className="access-grid"
                    aria-label="Accesos de Casa de Paz"
                  >
                    {shortcuts.map(({ id, title, Icon }) => (
                      <button
                        key={id}
                        className="access-card"
                        onClick={() => open(id)}
                        disabled={id === "papeletas"}
                      >
                        <span className="access-icon">
                          <Icon aria-hidden="true" />
                          {id === "reporte" && (
                            <Heart
                              className="report-heart"
                              aria-hidden="true"
                            />
                          )}
                        </span>
                        <span className="access-label">
                          {id === "reporte" ? (
                            <>
                              Reporte
                              <br />
                              Casa de Paz
                            </>
                          ) : (
                            title
                          )}
                        </span>
                        {id === "papeletas" && (
                          <small className="pending-label">Próximamente</small>
                        )}
                      </button>
                    ))}
                  </nav>
                </section>
              </main>

              <nav className="bottom-nav" aria-label="Navegación principal">
                <button
                  className="nav-item"
                  onClick={() => open(null)}
                  aria-current="page"
                >
                  <House aria-hidden="true" />
                  <span>Inicio</span>
                </button>
                <button
                  ref={menuButtonRef}
                  className="nav-item nav-menu"
                  onClick={() => open("menu")}
                >
                  <LayoutGrid aria-hidden="true" />
                  <span>Menú</span>
                </button>
                <button className="nav-item" onClick={() => open("calendario")}>
                  <CalendarDays aria-hidden="true" />
                  <span>Calendario</span>
                </button>
              </nav>
            </div>
          </>,
          shadow,
        )}
    </div>
  );
}
