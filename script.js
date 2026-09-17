// ============================================================================
// RESERVAPRO — LÓGICA PRINCIPAL (Firebase Firestore + Auth)
// ============================================================================
// PASSO 1: Cole aqui a configuração do SEU projeto Firebase.
// Veja o passo a passo completo em CONFIGURACAO.md
// ============================================================================
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDudFUwoqwPOb2oTfVEDcyI4h8OgZgbWr4",
  authDomain: "reservapro-minhaempresa.firebaseapp.com",
  projectId: "reservapro-minhaempresa",
  storageBucket: "reservapro-minhaempresa.firebasestorage.app",
  messagingSenderId: "1034441880565",
  appId: "1:1034441880565:web:73d7bdc0267884b76e66bc",
  measurementId: "G-W373CBWV6Y"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

const db = getFirestore(app);
const auth = getAuth(app);

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    // CONFIGURAÇÃO DO ESTABELECIMENTO
    const COMPANY_WHATSAPP = "5567999999999"; // Formato: 55 + DDD + número, sem espaços/símbolos

    // Horários padrão sugeridos na grade do admin (o admin pode adicionar outros manualmente)
    const DEFAULT_TIME_SLOTS = (() => {
        const slots = [];
        for (let h = 8; h < 20; h++) {
            slots.push(`${String(h).padStart(2, "0")}:00`);
            slots.push(`${String(h).padStart(2, "0")}:30`);
        }
        return slots;
    })();

    // ESTADO LOCAL (espelha o Firestore)
    let SERVICES = [];
    let selectedService = null;
    let selectedSlot = null;
    let isBooking = false;

    let clientDateUnsub = null;
    let clientSlotsData = {};

    let adminDateUnsub = null;
    let adminSlotsData = {};
    let appointmentsCache = [];

    // SELETORES
    const $ = (s) => document.querySelector(s);

    const connStatus = $("#connStatus");

    const btnClientView = $("#btnClientView");
    const btnAdminView = $("#btnAdminView");
    const clientSection = $("#clientSection");
    const adminSection = $("#adminSection");

    const servicesList = $("#servicesList");
    const appointmentDate = $("#appointmentDate");
    const slotsGrid = $("#slotsGrid");
    const slotCountBadge = $("#slotCountBadge");
    const bookingForm = $("#bookingForm");
    const bookingError = $("#bookingError");

    const summaryService = $("#summaryService");
    const summaryTime = $("#summaryTime");
    const summaryPrice = $("#summaryPrice");
    const btnConfirmBooking = $("#btnConfirmBooking");
    const btnConfirmLabel = $("#btnConfirmLabel");

    const adminLogin = $("#adminLogin");
    const adminPanel = $("#adminPanel");
    const loginForm = $("#loginForm");
    const loginError = $("#loginError");
    const btnLogout = $("#btnLogout");

    const adminDate = $("#adminDate");
    const adminSlotsGrid = $("#adminSlotsGrid");
    const customTimeInput = $("#customTimeInput");
    const btnAddCustomTime = $("#btnAddCustomTime");

    const serviceForm = $("#serviceForm");
    const adminServicesList = $("#adminServicesList");

    // FUNÇÕES AUXILIARES
    function formatCurrency(val) {
        return Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }

    function formatDate(dateStr) {
        const [y, m, d] = dateStr.split("-");
        return `${d}/${m}/${y}`;
    }

    function setMinDate() {
        const today = new Date().toISOString().split("T")[0];
        if (appointmentDate) appointmentDate.min = today;
        if (adminDate) adminDate.min = today;
    }

    function setConnStatus(state) {
        // state: "online" | "offline" | "error"
        connStatus.classList.remove("conn-online", "conn-offline", "conn-error");
        if (state === "online") {
            connStatus.classList.add("conn-online");
            connStatus.textContent = "● sincronizado em tempo real";
        } else if (state === "error") {
            connStatus.classList.add("conn-error");
            connStatus.textContent = "● erro de conexão";
        } else {
            connStatus.classList.add("conn-offline");
            connStatus.textContent = "● conectando...";
        }
    }

    // ========================================================================
    // SERVIÇOS (leitura pública em tempo real + CRUD no painel admin)
    // ========================================================================
    function subscribeServices() {
        onSnapshot(collection(db, "servicos"),
            (snap) => {
                SERVICES = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                renderServices();
                renderAdminServices();
                setConnStatus("online");
            },
            (err) => {
                console.error("Erro ao carregar serviços:", err);
                setConnStatus("error");
            }
        );
    }

    function renderServices() {
        if (!servicesList) return;

        if (SERVICES.length === 0) {
            servicesList.innerHTML = `<p class="select-prompt">Nenhum serviço cadastrado ainda. O proprietário precisa cadastrar serviços no painel admin.</p>`;
            return;
        }

        servicesList.innerHTML = SERVICES.map(s => `
            <div class="service-card ${selectedService?.id === s.id ? 'selected' : ''}" data-id="${s.id}">
                <div class="service-info">
                    <strong>${s.nome}</strong>
                    <span>Duração: ${s.duracao}</span>
                </div>
                <span class="service-price">${formatCurrency(s.preco)}</span>
            </div>
        `).join("");
    }

    function renderAdminServices() {
        if (!adminServicesList) return;

        if (SERVICES.length === 0) {
            adminServicesList.innerHTML = `<p class="select-prompt">Nenhum serviço cadastrado.</p>`;
            return;
        }

        adminServicesList.innerHTML = SERVICES.map(s => `
            <div class="admin-service-item">
                <span><strong>${s.nome}</strong> — ${formatCurrency(s.preco)} · ${s.duracao}</span>
                <button type="button" data-id="${s.id}" class="btn-delete-service">Remover</button>
            </div>
        `).join("");
    }

    serviceForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nome = $("#newServiceName").value.trim();
        const preco = parseFloat($("#newServicePrice").value);
        const duracao = $("#newServiceDuration").value.trim();

        if (!nome || isNaN(preco) || !duracao) return;

        try {
            await addDoc(collection(db, "servicos"), { nome, preco, duracao });
            serviceForm.reset();
        } catch (err) {
            console.error("Erro ao adicionar serviço:", err);
            alert("Não foi possível adicionar o serviço. Verifique sua conexão e login.");
        }
    });

    adminServicesList?.addEventListener("click", async (e) => {
        const btn = e.target.closest(".btn-delete-service");
        if (!btn) return;
        if (!confirm("Remover este serviço? Ele deixará de aparecer para novos clientes.")) return;

        try {
            await deleteDoc(doc(db, "servicos", btn.dataset.id));
        } catch (err) {
            console.error("Erro ao remover serviço:", err);
            alert("Não foi possível remover o serviço.");
        }
    });

    servicesList?.addEventListener("click", (e) => {
        const card = e.target.closest(".service-card");
        if (!card) return;
        selectedService = SERVICES.find(s => s.id === card.dataset.id) || null;
        renderServices();
        updateSummary();
    });

    // ========================================================================
    // GRADE DE HORÁRIOS — VISÃO DO CLIENTE (leitura em tempo real por data)
    // ========================================================================
    function subscribeClientSlots(dateVal) {
        if (clientDateUnsub) clientDateUnsub();
        if (!dateVal) {
            clientSlotsData = {};
            renderTimeSlotsForClient();
            return;
        }

        const slotRef = doc(db, "horarios_liberados", dateVal);
        clientDateUnsub = onSnapshot(slotRef,
            (snap) => {
                clientSlotsData = snap.exists() ? (snap.data().horarios || {}) : {};
                renderTimeSlotsForClient();
            },
            (err) => {
                console.error("Erro ao carregar horários:", err);
                setConnStatus("error");
            }
        );
    }

    function renderTimeSlotsForClient() {
        if (!slotsGrid) return;
        const dateVal = appointmentDate.value;

        if (!dateVal) {
            slotsGrid.innerHTML = `<p class="select-prompt">Selecione uma data para consultar os horários liberados pelo estabelecimento.</p>`;
            slotCountBadge.textContent = "0 livres";
            return;
        }

        const entries = Object.entries(clientSlotsData).sort((a, b) => a[0].localeCompare(b[0]));

        if (entries.length === 0) {
            slotsGrid.innerHTML = `<p class="select-prompt">Não há horários liberados pelo proprietário para esta data.</p>`;
            slotCountBadge.textContent = "0 livres";
            return;
        }

        const freeCount = entries.filter(([, status]) => status === "livre").length;
        slotCountBadge.textContent = `${freeCount} livres`;

        slotsGrid.innerHTML = entries.map(([time, status]) => {
            const isBooked = status !== "livre";
            const isSelected = selectedSlot === time;

            return `
                <button type="button"
                        class="slot-btn ${isSelected ? 'selected' : ''}"
                        data-time="${time}"
                        ${isBooked ? 'disabled' : ''}>
                    ${time} ${isBooked ? '(Reservado)' : ''}
                </button>
            `;
        }).join("");
    }

    function updateSummary() {
        summaryService.textContent = selectedService ? selectedService.nome : "Nenhum";

        if (selectedSlot && appointmentDate.value) {
            summaryTime.textContent = `${formatDate(appointmentDate.value)} às ${selectedSlot}`;
        } else {
            summaryTime.textContent = "--:--";
        }

        summaryPrice.textContent = selectedService ? formatCurrency(selectedService.preco) : "R$ 0,00";
        btnConfirmBooking.disabled = !(selectedService && selectedSlot && appointmentDate.value) || isBooking;
    }

    // ========================================================================
    // RESERVA — TRANSAÇÃO ATÔMICA (evita dois clientes reservarem o mesmo horário)
    // ========================================================================
    async function bookAppointmentTransaction(app) {
        const slotRef = doc(db, "horarios_liberados", app.data);

        await runTransaction(db, async (tx) => {
            const slotSnap = await tx.get(slotRef);
            if (!slotSnap.exists()) {
                throw new Error("Este horário não está mais disponível.");
            }
            const horarios = slotSnap.data().horarios || {};
            if (horarios[app.hora] !== "livre") {
                throw new Error("Esse horário acabou de ser reservado por outro cliente. Escolha outro.");
            }

            horarios[app.hora] = "reservado";
            tx.update(slotRef, { horarios });

            const agendamentoRef = doc(collection(db, "agendamentos"));
            tx.set(agendamentoRef, app);
        });
    }

    function generateWhatsAppMessage(app) {
        let msg = `*NOVO AGENDAMENTO*\n\n`;
        msg += `*Cliente:* ${app.clienteNome}\n`;
        msg += `*Telefone:* ${app.clienteTelefone}\n`;
        msg += `*Serviço:* ${app.servicoNome}\n`;
        msg += `*Data:* ${formatDate(app.data)}\n`;
        msg += `*Horário:* ${app.hora}\n`;
        msg += `*Valor:* ${formatCurrency(app.preco)}\n`;
        if (app.observacoes) msg += `*Obs:* ${app.observacoes}\n`;

        return `https://wa.me/${COMPANY_WHATSAPP}?text=${encodeURIComponent(msg)}`;
    }

    bookingForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!selectedService || !selectedSlot || !appointmentDate.value || isBooking) return;

        bookingError.textContent = "";
        isBooking = true;
        btnConfirmLabel.textContent = "Confirmando...";
        btnConfirmBooking.disabled = true;

        const newAppointment = {
            servicoNome: selectedService.nome,
            preco: selectedService.preco,
            data: appointmentDate.value,
            hora: selectedSlot,
            clienteNome: $("#clientName").value.trim(),
            clienteTelefone: $("#clientPhone").value.trim(),
            observacoes: $("#bookingNotes").value.trim(),
            criadoEm: Date.now()
        };

        try {
            await bookAppointmentTransaction(newAppointment);
            window.open(generateWhatsAppMessage(newAppointment), "_blank");

            bookingForm.reset();
            selectedService = null;
            selectedSlot = null;
            renderServices();
            renderTimeSlotsForClient();
        } catch (err) {
            console.error("Erro ao confirmar agendamento:", err);
            bookingError.textContent = err.message || "Não foi possível confirmar o agendamento. Tente novamente.";
        } finally {
            isBooking = false;
            btnConfirmLabel.textContent = "Enviar Pedido no WhatsApp";
            updateSummary();
        }
    });

    appointmentDate?.addEventListener("change", () => {
        selectedSlot = null;
        subscribeClientSlots(appointmentDate.value);
        updateSummary();
    });

    slotsGrid?.addEventListener("click", (e) => {
        const btn = e.target.closest(".slot-btn");
        if (!btn || btn.disabled) return;
        selectedSlot = btn.dataset.time;
        renderTimeSlotsForClient();
        updateSummary();
    });

    // ========================================================================
    // NAVEGAÇÃO ENTRE VISÕES
    // ========================================================================
    btnClientView?.addEventListener("click", () => {
        btnClientView.classList.add("active");
        btnAdminView.classList.remove("active");
        clientSection.classList.remove("hidden");
        adminSection.classList.add("hidden");
    });

    btnAdminView?.addEventListener("click", () => {
        btnAdminView.classList.add("active");
        btnClientView.classList.remove("active");
        adminSection.classList.remove("hidden");
        clientSection.classList.add("hidden");
    });

    // ========================================================================
    // AUTENTICAÇÃO DO ADMIN
    // ========================================================================
    loginForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        loginError.textContent = "";
        const email = $("#adminEmail").value.trim();
        const password = $("#adminPassword").value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            loginForm.reset();
        } catch (err) {
            console.error("Erro de login:", err);
            loginError.textContent = "E-mail ou senha inválidos.";
        }
    });

    btnLogout?.addEventListener("click", () => signOut(auth));

    onAuthStateChanged(auth, (user) => {
        if (user) {
            adminLogin.classList.add("hidden");
            adminPanel.classList.remove("hidden");
            subscribeAppointments();
        } else {
            adminLogin.classList.remove("hidden");
            adminPanel.classList.add("hidden");
            if (adminDateUnsub) { adminDateUnsub(); adminDateUnsub = null; }
        }
    });

    // ========================================================================
    // GESTÃO DE HORÁRIOS — PAINEL ADMIN
    // ========================================================================
    function subscribeAdminSlots(dateVal) {
        if (adminDateUnsub) adminDateUnsub();
        if (!dateVal) {
            adminSlotsData = {};
            renderAdminSlots();
            return;
        }

        const slotRef = doc(db, "horarios_liberados", dateVal);
        adminDateUnsub = onSnapshot(slotRef,
            (snap) => {
                adminSlotsData = snap.exists() ? (snap.data().horarios || {}) : {};
                renderAdminSlots();
            },
            (err) => console.error("Erro ao carregar grade admin:", err)
        );
    }

    function renderAdminSlots() {
        if (!adminSlotsGrid) return;
        if (!adminDate.value) {
            adminSlotsGrid.innerHTML = `<p class="select-prompt">Selecione uma data.</p>`;
            return;
        }

        const allTimes = new Set([...DEFAULT_TIME_SLOTS, ...Object.keys(adminSlotsData)]);
        const sorted = [...allTimes].sort((a, b) => a.localeCompare(b));

        adminSlotsGrid.innerHTML = sorted.map(time => {
            const status = adminSlotsData[time]; // undefined | "livre" | "reservado"
            const stateClass = status === "reservado" ? "state-reservado" : (status === "livre" ? "state-livre" : "state-fechado");
            const label = status === "reservado" ? `${time} (Reservado)` : time;
            const disabled = status === "reservado" ? "disabled" : "";

            return `<button type="button" class="slot-btn ${stateClass}" data-time="${time}" data-status="${status || 'fechado'}" ${disabled}>${label}</button>`;
        }).join("");
    }

    adminDate?.addEventListener("change", () => subscribeAdminSlots(adminDate.value));

    adminSlotsGrid?.addEventListener("click", async (e) => {
        const btn = e.target.closest(".slot-btn");
        if (!btn || btn.disabled || !adminDate.value) return;

        const time = btn.dataset.time;
        const status = btn.dataset.status;
        const slotRef = doc(db, "horarios_liberados", adminDate.value);

        try {
            if (status === "fechado") {
                // Abre o horário para os clientes
                await setDoc(slotRef, { horarios: { [time]: "livre" } }, { merge: true });
            } else if (status === "livre") {
                // Fecha o horário novamente
                await updateDoc(slotRef, { [`horarios.${time}`]: deleteField() });
            }
        } catch (err) {
            console.error("Erro ao atualizar horário:", err);
            alert("Não foi possível atualizar esse horário. Verifique se você está logado.");
        }
    });

    btnAddCustomTime?.addEventListener("click", async () => {
        const time = customTimeInput.value;
        if (!time || !adminDate.value) return;

        const slotRef = doc(db, "horarios_liberados", adminDate.value);
        try {
            await setDoc(slotRef, { horarios: { [time]: "livre" } }, { merge: true });
            customTimeInput.value = "";
        } catch (err) {
            console.error("Erro ao adicionar horário customizado:", err);
            alert("Não foi possível adicionar o horário.");
        }
    });

    // ========================================================================
    // AGENDAMENTOS — PAINEL ADMIN (tempo real + cancelamento)
    // ========================================================================
    function subscribeAppointments() {
        const q = query(collection(db, "agendamentos"), orderBy("data"));
        onSnapshot(q,
            (snap) => {
                appointmentsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                renderAdminAppointments();
            },
            (err) => console.error("Erro ao carregar agendamentos:", err)
        );
    }

    function renderAdminAppointments() {
        const totalCount = appointmentsCache.length;
        const totalRevenue = appointmentsCache.reduce((acc, cur) => acc + (cur.preco || 0), 0);

        $("#statTotalCount").textContent = totalCount;
        $("#statTotalRevenue").textContent = formatCurrency(totalRevenue);

        const listContainer = $("#adminAppointmentsList");
        if (!listContainer) return;

        if (totalCount === 0) {
            listContainer.innerHTML = `<p class="select-prompt">Nenhum agendamento confirmado ainda.</p>`;
            return;
        }

        const sorted = [...appointmentsCache].sort((a, b) =>
            new Date(`${a.data}T${a.hora}`) - new Date(`${b.data}T${b.hora}`)
        );

        listContainer.innerHTML = sorted.map(app => `
            <div class="appointment-item">
                <div class="info">
                    <strong>${app.clienteNome} (${app.clienteTelefone})</strong><br>
                    <span>${app.servicoNome} - ${formatCurrency(app.preco)}</span><br>
                    <small>📅 ${formatDate(app.data)} às ${app.hora}</small>
                </div>
                <div class="appointment-actions">
                    <span class="status-badge">Confirmado</span>
                    <button type="button" class="cancel-btn" data-id="${app.id}" data-date="${app.data}" data-time="${app.hora}">Cancelar</button>
                </div>
            </div>
        `).join("");
    }

    $("#adminAppointmentsList")?.addEventListener("click", async (e) => {
        const btn = e.target.closest(".cancel-btn");
        if (!btn) return;
        if (!confirm("Cancelar este agendamento? O horário voltará a ficar livre para outros clientes.")) return;

        const { id, date, time } = btn.dataset;
        const slotRef = doc(db, "horarios_liberados", date);
        const appRef = doc(db, "agendamentos", id);

        try {
            await runTransaction(db, async (tx) => {
                const slotSnap = await tx.get(slotRef);
                if (slotSnap.exists()) {
                    const horarios = slotSnap.data().horarios || {};
                    horarios[time] = "livre";
                    tx.update(slotRef, { horarios });
                }
                tx.delete(appRef);
            });
        } catch (err) {
            console.error("Erro ao cancelar agendamento:", err);
            alert("Não foi possível cancelar o agendamento.");
        }
    });

    // ========================================================================
    // INICIALIZAÇÃO
    // ========================================================================
    setMinDate();
    subscribeServices();
    renderTimeSlotsForClient();
    updateSummary();
});

