/* =========================================================
   DATOS
========================================================= */

const defaultProducts = [

    {
        id: 1,
        code: "779000000001",
        name: "Alfajor Triple",
        price: 800,
        stock: 20,
        saleType: "unit"
    },

    {
        id: 2,
        code: "779000000002",
        name: "Gaseosa Cola 500ml",
        price: 1200,
        stock: 20,
        saleType: "unit"
    },

    {
        id: 3,
        code: "779000000003",
        name: "Agua Mineral 500ml",
        price: 900,
        stock: 20,
        saleType: "unit"
    },

    {
        id: 4,
        code: "779000000004",
        name: "Chicles de Menta",
        price: 300,
        stock: 20,
        saleType: "unit"
    },

    {
        id: 5,
        code: "779000000005",
        name: "Papas Fritas Bolsa",
        price: 1500,
        stock: 20,
        saleType: "unit"
    }

];

let products =
    JSON.parse(localStorage.getItem("products"))
    || defaultProducts;

let cart =
    JSON.parse(localStorage.getItem("cart"))
    || [];

let sales =
    JSON.parse(localStorage.getItem("sales"))
    || [];

let editingProductId = null;


/* =========================================================
   MIGRACIÓN DE PRODUCTOS
========================================================= */

products.forEach(product => {

    if (!product.saleType) {
        product.saleType = "unit";
    }

    if (
        product.saleType === "weight"
        &&
        !product.priceUnit
    ) {
        product.priceUnit = 1000;
    }

});

saveProducts();


/* =========================================================
   MIGRACIÓN DEL CARRITO
========================================================= */

cart.forEach(item => {

    const product =
        products.find(
            p => p.id === item.id
        );

    if (!product) return;

    if (!item.saleType) {
        item.saleType =
            product.saleType || "unit";
    }

    if (item.saleType === "weight") {

        if (typeof item.weight !== "number") {

            item.weight =
                Number(item.quantity) || 0;

        }

        item.quantity =
            item.weight;

    }

});

saveCart();


/* =========================================================
   SCANNER
========================================================= */

let scannerStream = null;
let scannerActive = false;
let barcodeDetector = null;
let scannerMode = "sale";

let lastDetectedCode = null;
let scannerCooldown = false;


/* =========================================================
   SONIDO DEL SCANNER
========================================================= */

function playScanSound() {

    const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext;

    if (!AudioContext) {
        return;
    }

    const audioContext =
        new AudioContext();

    const oscillator =
        audioContext.createOscillator();

    const gain =
        audioContext.createGain();

    oscillator.type =
        "sine";

    oscillator.frequency.value =
        1000;

    gain.gain.setValueAtTime(
        0.15,
        audioContext.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.12
    );

    oscillator.connect(gain);

    gain.connect(
        audioContext.destination
    );

    oscillator.start();

    oscillator.stop(
        audioContext.currentTime + 0.12
    );

}


/* =========================================================
   ABRIR SCANNER
========================================================= */

async function openScanner(mode = "sale") {

    scannerMode = mode;

    const modal =
        document.getElementById("scanner-modal");

    const video =
        document.getElementById("scanner-video");

    const status =
        document.getElementById("scanner-status");

    const codeLabel =
        document.getElementById("scanner-code");

    const productMessage =
        document.getElementById(
            "scanner-product-message"
        );

    const title =
        document.querySelector(
            "#scanner-modal h2"
        );

    modal.style.display =
        "flex";

    if (scannerMode === "product") {

        title.textContent =
            "📷 Registrar código";

    } else {

        title.textContent =
            "📷 Escanear productos";

    }

    codeLabel.textContent =
        "Código: —";

    productMessage.textContent =
        "";

    status.textContent =
        "Iniciando cámara...";

    scannerActive = false;
    scannerCooldown = false;
    lastDetectedCode = null;

    if (!("BarcodeDetector" in window)) {

        status.textContent =
            "❌ Este navegador no soporta BarcodeDetector.";

        return;

    }

    try {

        barcodeDetector =
            new BarcodeDetector({

                formats: [
                    "ean_13",
                    "ean_8",
                    "upc_a",
                    "upc_e",
                    "code_128"
                ]

            });


        scannerStream =
            await navigator.mediaDevices.getUserMedia({

                video: {

                    facingMode: {
                        ideal: "environment"
                    },

                    width: {
                        ideal: 4096
                    },

                    height: {
                        ideal: 2160
                    },

                    aspectRatio: {
                        ideal: 16 / 9
                    },

                    resizeMode: "none"

                },

                audio: false

            });


        video.srcObject =
            scannerStream;


        const track =
            scannerStream.getVideoTracks()[0];

        const settings =
            track.getSettings();

        console.log(
            "Resolución real de cámara:",
            settings.width,
            "x",
            settings.height
        );


        scannerActive = true;

        status.textContent =
            scannerMode === "sale"
                ? "🟢 Buscando producto..."
                : "🟢 Buscando código...";


        buscarCodigo();

    } catch (error) {

        console.error(error);

        status.textContent =
            "❌ No se pudo iniciar la cámara: "
            + error.name;

    }

}


function openProductScanner() {

    openScanner("product");

}


/* =========================================================
   BUSCAR CÓDIGO
========================================================= */

async function buscarCodigo() {

    if (!scannerActive) {
        return;
    }

    const video =
        document.getElementById(
            "scanner-video"
        );

    try {

        const barcodes =
            await barcodeDetector.detect(video);

        if (
            barcodes.length > 0
            &&
            !scannerCooldown
        ) {

            const codigo =
                barcodes[0].rawValue;


            if (
                codigo === lastDetectedCode
            ) {

                requestAnimationFrame(
                    buscarCodigo
                );

                return;

            }


            lastDetectedCode =
                codigo;

            scannerCooldown = true;


            document.getElementById(
                "scanner-code"
            ).textContent =
                "Código: " + codigo;


            /* =========================================
               MODO PRODUCTO
            ========================================= */

            if (
                scannerMode === "product"
            ) {

                detenerScanner();

                document.getElementById(
                    "product-code"
                ).value =
                    codigo;

                validateProductCode();

                document.getElementById(
                    "scanner-status"
                ).textContent =
                    "✅ Código leído";

                setTimeout(() => {

                    closeScanner();

                }, 500);

                return;

            }


            /* =========================================
               MODO VENTA
            ========================================= */

            const product =
                products.find(
                    p =>
                        String(p.code) ===
                        String(codigo)
                );


            if (!product) {

                document.getElementById(
                    "scanner-status"
                ).textContent =
                    "❌ Producto no encontrado";

                alert(
                    "No existe un producto con el código "
                    + codigo
                );

            }

            else if (
                product.stock <= 0
            ) {

                document.getElementById(
                    "scanner-status"
                ).textContent =
                    "❌ Producto sin stock";

                alert(
                    product.name +
                    " no tiene stock disponible."
                );

            }

            else {

                addToCart(product.id);

                playScanSound();

                document.getElementById(
                    "scanner-product-message"
                ).textContent =
                    "✓ " +
                    product.name +
                    " agregado";

                document.getElementById(
                    "scanner-status"
                ).textContent =
                    "⏳ Esperando...";

            }


            setTimeout(() => {

                scannerCooldown = false;
                lastDetectedCode = null;

                document.getElementById(
                    "scanner-product-message"
                ).textContent = "";

                if (scannerActive) {

                    document.getElementById(
                        "scanner-status"
                    ).textContent =
                        "🟢 Buscando producto...";

                }

            }, 1000);

        }

    } catch (error) {

        console.error(error);

    }


    if (scannerActive) {

        requestAnimationFrame(
            buscarCodigo
        );

    }

}


/* =========================================================
   DETENER / CERRAR SCANNER
========================================================= */

function detenerScanner() {

    scannerActive = false;

    scannerCooldown = false;
    lastDetectedCode = null;

    if (scannerStream) {

        scannerStream
            .getTracks()
            .forEach(track => track.stop());

        scannerStream = null;

    }

    const video =
        document.getElementById(
            "scanner-video"
        );

    video.srcObject = null;

}


function closeScanner() {

    detenerScanner();

    scannerMode = "sale";

    document.getElementById(
        "scanner-product-message"
    ).textContent = "";

    document.getElementById(
        "scanner-modal"
    ).style.display =
        "none";

}


/* =========================================================
   STORAGE
========================================================= */

function saveProducts() {

    localStorage.setItem(
        "products",
        JSON.stringify(products)
    );

}


function saveCart() {

    localStorage.setItem(
        "cart",
        JSON.stringify(cart)
    );

}


function saveSales() {

    localStorage.setItem(
        "sales",
        JSON.stringify(sales)
    );

}


/* =========================================================
   EXPORTAR DATOS
========================================================= */

function exportData() {

    const exportedSales =
        sales.map(sale => ({

            ...sale,

            items: sale.items.map(item => {

                const {
                    subtotal,
                    ...itemWithoutSubtotal
                } = item;

                return itemWithoutSubtotal;

            })

        }));


    const data = {

        products: products,

        sales: exportedSales,

        exportDate:
            new Date().toISOString()

    };


    const json =
        JSON.stringify(
            data,
            null,
            2
        );


    const blob =
        new Blob(
            [json],
            {
                type: "application/json"
            }
        );


    const url =
        URL.createObjectURL(blob);


    const link =
        document.createElement("a");


    const date =
        new Date()
            .toISOString()
            .slice(0, 10);


    link.href =
        url;

    link.download =
        "kiosco_backup_" +
        date +
        ".json";


    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);


    alert(
        "Datos exportados correctamente."
    );

}


/* =========================================================
   MIGRACIÓN DEL STOCK
========================================================= */

if (
    cart.length > 0
    &&
    localStorage.getItem(
        "cartStockReserved"
    ) !== "true"
) {

    cart.forEach(item => {

        const product =
            products.find(
                p => p.id === item.id
            );

        if (product) {

            if (
                product.saleType === "weight"
            ) {

                const reservedWeight =
                    Number(
                        item.weight ??
                        item.quantity ??
                        0
                    );

                product.stock =
                    Math.max(
                        0,
                        product.stock -
                        reservedWeight
                    );

            } else {

                product.stock =
                    Math.max(
                        0,
                        product.stock -
                        (
                            Number(item.quantity)
                            || 0
                        )
                    );

            }

        }

    });

    saveProducts();

    localStorage.setItem(
        "cartStockReserved",
        "true"
    );

}


/* =========================================================
   CATÁLOGO
========================================================= */

function renderCatalog(list) {

    const container =
        document.getElementById(
            "products"
        );

    container.innerHTML = "";

    list.forEach(product => {

        const card =
            document.createElement("div");

        card.className =
            "product-card";

        if (product.stock <= 0) {

            card.classList.add(
                "disabled"
            );

        }

        card.onclick = () => {

            if (product.stock > 0) {
                addToCart(product.id);
            }

        };


        let stockText;

        if (product.stock <= 0) {

            stockText =
                "Sin stock";

        } else if (
            product.saleType === "weight"
        ) {

            stockText =
                `Stock: ${formatWeight(
                    product.stock
                )}`;

        } else {

            stockText =
                `Stock: ${product.stock}`;

        }


        let priceText;

        if (product.saleType === "weight") {

            const unit =
                Number(product.priceUnit) === 100
                    ? "100 g"
                    : "1 kg";

            priceText =
                `$${formatMoney(
                    product.price
                )} / ${unit}`;

        } else {

            priceText =
                `$${formatMoney(
                    product.price
                )}`;

        }


        card.innerHTML = `

            <div class="p-name">
                ${escapeHTML(product.name)}
            </div>

            <div class="p-price">
                ${priceText}
            </div>

            <div
                class="p-stock ${
                    product.stock <= 0
                        ? "zero"
                        : ""
                }"
            >
                ${stockText}
            </div>

        `;

        container.appendChild(card);

    });

}


function filterProducts() {

    const query =
        document
            .getElementById("search")
            .value
            .toLowerCase()
            .trim();

    const filtered =
        products.filter(product =>

            product.name
                .toLowerCase()
                .includes(query)

            ||

            String(product.code)
                .includes(query)

        );

    renderCatalog(filtered);

}


/* =========================================================
   CARRITO — AGREGAR
========================================================= */

function addToCart(id) {

    const product =
        products.find(
            p => p.id === id
        );

    if (
        !product
        ||
        product.stock <= 0
    ) {

        alert(
            "No hay stock disponible."
        );

        return;

    }


    if (product.saleType === "weight") {

        const existing =
            cart.find(
                item => item.id === id
            );

        if (existing) {
            return;
        }

        const defaultWeight =
            Number(product.priceUnit) === 100
                ? 100
                : 1000;

        if (product.stock < defaultWeight) {

            alert(
                "No hay suficiente stock para "
                +
                formatWeight(defaultWeight)
                + "."
            );

            return;

        }

        product.stock -=
            defaultWeight;

        cart.push({

            id: product.id,

            code: product.code,

            name: product.name,

            price: product.price,

            saleType: "weight",

            priceUnit:
                Number(product.priceUnit)
                || 1000,

            weight: defaultWeight,

            quantity: defaultWeight

        });

        saveProducts();
        saveCart();

        renderCatalog(
            getFilteredProducts()
        );

        updateCartUI();

        return;

    }


    const existing =
        cart.find(
            item => item.id === id
        );

    product.stock -= 1;

    if (existing) {

        existing.quantity += 1;

    } else {

        cart.push({

            id: product.id,

            code: product.code,

            name: product.name,

            price: product.price,

            saleType: "unit",

            quantity: 1

        });

    }

    saveProducts();
    saveCart();

    renderCatalog(
        getFilteredProducts()
    );

    updateCartUI();

}


/* =========================================================
   CARRITO — CANTIDAD
========================================================= */

function increaseCart(id) {

    const product =
        products.find(
            p => p.id === id
        );

    if (
        product
        &&
        product.saleType === "weight"
    ) {
        return;
    }

    addToCart(id);

}


function decreaseCart(id) {

    const item =
        cart.find(
            i => i.id === id
        );

    if (!item) return;

    const product =
        products.find(
            p => p.id === id
        );

    if (!product) return;


    if (
        product.saleType === "weight"
        ||
        item.saleType === "weight"
    ) {
        return;
    }


    product.stock += 1;

    item.quantity -= 1;

    if (item.quantity <= 0) {

        cart =
            cart.filter(
                i => i.id !== id
            );

    }

    saveProducts();
    saveCart();

    renderCatalog(
        getFilteredProducts()
    );

    updateCartUI();

}


/* =========================================================
   CAMBIAR PESO
========================================================= */

function changeCartWeight(id, value) {

    const item =
        cart.find(
            i => i.id === id
        );

    if (!item) return;

    const product =
        products.find(
            p => p.id === id
        );

    if (!product) return;

    if (
        product.saleType !== "weight"
    ) {
        return;
    }

    let newWeight =
        Number(value);

    if (
        !Number.isFinite(newWeight)
        ||
        newWeight <= 0
    ) {
        return;
    }

    newWeight =
        Math.floor(newWeight);

    const oldWeight =
        Number(item.weight) || 0;

    const difference =
        newWeight - oldWeight;


    if (difference > 0) {

        if (
            product.stock <
            difference
        ) {

            alert(
                "No hay suficiente stock disponible."
            );

            updateCartUI();

            return;

        }

        product.stock -=
            difference;

    }


    if (difference < 0) {

        product.stock +=
            Math.abs(difference);

    }


    item.weight =
        newWeight;

    item.quantity =
        newWeight;

    saveProducts();
    saveCart();

    renderCatalog(
        getFilteredProducts()
    );

    updateCartUI();

}


/* =========================================================
   SUGERENCIAS DE PESO
========================================================= */

function setSuggestedWeight(id, weight) {

    changeCartWeight(
        id,
        weight
    );

}


function getWeightSuggestions(priceUnit) {

    if (
        Number(priceUnit) === 100
    ) {

        return [
            50,
            100,
            150,
            200
        ];

    }

    return [
        250,
        500,
        750,
        1000
    ];

}


function renderWeightSuggestions(
    id,
    priceUnit,
    currentWeight
) {

    const suggestions =
        getWeightSuggestions(
            priceUnit
        );

    return `

        <div class="weight-options">

            ${
                suggestions
                    .map(weight => `

                        <button
                            type="button"
                            class="weight-option"
                            onclick="
                                setSuggestedWeight(
                                    ${id},
                                    ${weight}
                                )
                            "
                        >
                            ${
                                weight >= 1000
                                    ? "1 kg"
                                    : weight + " g"
                            }
                        </button>

                    `)
                    .join("")
            }

        </div>

    `;

}


/* =========================================================
   ELIMINAR DEL CARRITO
========================================================= */

function removeFromCart(id) {

    const item =
        cart.find(
            i => i.id === id
        );

    if (!item) return;

    const product =
        products.find(
            p => p.id === id
        );

    if (product) {

        if (
            product.saleType === "weight"
            ||
            item.saleType === "weight"
        ) {

            product.stock +=
                Number(
                    item.weight ??
                    item.quantity ??
                    0
                );

        } else {

            product.stock +=
                Number(item.quantity)
                || 0;

        }

    }

    cart =
        cart.filter(
            i => i.id !== id
        );

    saveProducts();
    saveCart();

    renderCatalog(
        getFilteredProducts()
    );

    updateCartUI();

}


/* =========================================================
   VACIAR CARRITO
========================================================= */

function clearCart() {

    cart.forEach(item => {

        const product =
            products.find(
                p => p.id === item.id
            );

        if (product) {

            if (
                product.saleType === "weight"
                ||
                item.saleType === "weight"
            ) {

                product.stock +=
                    Number(
                        item.weight ??
                        item.quantity ??
                        0
                    );

            } else {

                product.stock +=
                    Number(item.quantity)
                    || 0;

            }

        }

    });

    cart = [];

    saveProducts();
    saveCart();

    renderCatalog(
        getFilteredProducts()
    );

    updateCartUI();

}


/* =========================================================
   ACTUALIZAR CARRITO
========================================================= */

function updateCartUI() {

    const container =
        document.getElementById(
            "cart-items"
        );

    const totalLabel =
        document.getElementById(
            "total-amount"
        );

    const countLabel =
        document.getElementById(
            "cart-count"
        );

    const checkoutButton =
        document.getElementById(
            "checkout-btn"
        );

    container.innerHTML = "";

    let total = 0;


    cart.forEach(item => {

        const product =
            products.find(
                p => p.id === item.id
            );

        const isWeight =
            item.saleType === "weight"
            ||
            (
                product
                &&
                product.saleType === "weight"
            );


        let subtotal;


        if (isWeight) {

            const weight =
                Number(
                    item.weight ??
                    item.quantity ??
                    0
                );

            const priceUnit =
                Number(
                    item.priceUnit ??
                    product?.priceUnit ??
                    1000
                );

            subtotal =
                weight *
                Number(item.price) /
                priceUnit;

        } else {

            subtotal =
                Number(item.price) *
                Number(item.quantity);

        }


        total += subtotal;


        const div =
            document.createElement("div");

        div.className =
            "cart-item";


        if (isWeight) {

            const weight =
                Number(
                    item.weight ??
                    item.quantity ??
                    0
                );

            const priceUnit =
                Number(
                    item.priceUnit ??
                    product?.priceUnit ??
                    1000
                );

            const unitText =
                priceUnit === 100
                    ? "100 g"
                    : "1 kg";


            div.innerHTML = `

                <div class="item-details">

                    <span class="item-name">
                        ${escapeHTML(item.name)}
                    </span>

                    <span class="item-price">
                        $${formatMoney(item.price)}
                        / ${unitText}
                    </span>

                </div>

                <div
                    class="item-actions"
                    style="
                        flex-wrap: wrap;
                        justify-content: flex-end;
                    "
                >

                    <input
                        class="weight-input"
                        type="number"
                        min="1"
                        step="1"
                        value="${weight}"
                        onchange="
                            changeCartWeight(
                                ${item.id},
                                this.value
                            )
                        "
                    >

                    <span class="weight-unit">
                        g
                    </span>

                    <strong>
                        $${formatMoney(subtotal)}
                    </strong>

                    <button
                        class="btn-remove"
                        onclick="
                            removeFromCart(
                                ${item.id}
                            )
                        "
                    >
                        ✕
                    </button>

                    ${
                        renderWeightSuggestions(
                            item.id,
                            priceUnit,
                            weight
                        )
                    }

                </div>

            `;

        } else {

            div.innerHTML = `

                <div class="item-details">

                    <span class="item-name">
                        ${escapeHTML(item.name)}
                    </span>

                    <span class="item-price">
                        $${formatMoney(item.price)}
                    </span>

                </div>

                <div class="item-actions">

                    <button
                        class="qty-btn"
                        onclick="
                            decreaseCart(
                                ${item.id}
                            )
                        "
                    >
                        −
                    </button>

                    <strong>
                        ${item.quantity}
                    </strong>

                    <button
                        class="qty-btn"
                        onclick="
                            increaseCart(
                                ${item.id}
                            )
                        "
                    >
                        +
                    </button>

                    <strong>
                        $${formatMoney(subtotal)}
                    </strong>

                    <button
                        class="btn-remove"
                        onclick="
                            removeFromCart(
                                ${item.id}
                            )
                        "
                    >
                        ✕
                    </button>

                </div>

            `;

        }

        container.appendChild(div);

    });


    totalLabel.textContent =
        "$" + formatMoney(total);


    const cartCount =
        cart.reduce(
            (sum, item) =>
                sum + 1,
            0
        );

    countLabel.textContent =
        cartCount;

    checkoutButton.disabled =
        cart.length === 0;

}


/* =========================================================
   TOTAL
========================================================= */

function getCartTotal() {

    return cart.reduce(
        (sum, item) => {

            const product =
                products.find(
                    p => p.id === item.id
                );

            const isWeight =
                item.saleType === "weight"
                ||
                (
                    product
                    &&
                    product.saleType === "weight"
                );


            if (isWeight) {

                const weight =
                    Number(
                        item.weight ??
                        item.quantity ??
                        0
                    );

                const priceUnit =
                    Number(
                        item.priceUnit ??
                        product?.priceUnit ??
                        1000
                    );

                return sum +
                    (
                        weight *
                        Number(item.price) /
                        priceUnit
                    );

            }

            return sum +
                Number(item.price) *
                Number(item.quantity);

        },
        0
    );

}


/* =========================================================
   PAGO / VENTA
========================================================= */

let cashBillHistory = [];


function openPayment() {

    if (cart.length === 0) {

        alert(
            "El carrito está vacío."
        );

        return;

    }

    const total =
        getCartTotal();

    document.getElementById(
        "payment-total"
    ).textContent =
        "$" +
        formatMoney(total);

    document.getElementById(
        "payment-method"
    ).value =
        "efectivo";

    cashBillHistory = [];

    document.getElementById(
        "cash-received"
    ).value = "";

    document.getElementById(
        "cash-change"
    ).textContent =
        "Vuelto: $0";

    document.getElementById(
        "cash-change"
    ).className =
        "payment-change-result invalid";

    document.getElementById(
        "cash-payment-box"
    ).style.display =
        "block";

    document.getElementById(
        "confirm-sale-btn"
    ).disabled =
        true;

    document.getElementById(
        "payment-modal"
    ).style.display =
        "flex";

}


function addCashBill(amount) {

    const input =
        document.getElementById(
            "cash-received"
        );

    const current =
        Number(input.value) || 0;

    const newAmount =
        current + amount;

    cashBillHistory.push(amount);

    input.value =
        newAmount;

    calculateChange();

}


function removeLastCashBill() {

    if (cashBillHistory.length === 0) {
        return;
    }

    const lastAmount =
        cashBillHistory.pop();

    const input =
        document.getElementById(
            "cash-received"
        );

    const current =
        Number(input.value) || 0;

    const newAmount =
        Math.max(
            0,
            current - lastAmount
        );

    input.value =
        newAmount;

    calculateChange();

}


function clearCashReceived() {

    cashBillHistory = [];

    document.getElementById(
        "cash-received"
    ).value = "";

    calculateChange();

}


function calculateChange() {

    const total =
        getCartTotal();

    const input =
        document.getElementById(
            "cash-received"
        );

    const received =
        Number(input.value);

    const changeLabel =
        document.getElementById(
            "cash-change"
        );

    const confirmButton =
        document.getElementById(
            "confirm-sale-btn"
        );


    if (
        input.value.trim() === ""
        ||
        !Number.isFinite(received)
        ||
        received < total
    ) {

        const missing =
            total -
            (
                Number.isFinite(received)
                    ? received
                    : 0
            );

        changeLabel.textContent =
            "Faltan: $" +
            formatMoney(
                Math.max(
                    0,
                    missing
                )
            );

        changeLabel.className =
            "payment-change-result invalid";

        confirmButton.disabled =
            true;

        return false;

    }


    const change =
        Math.round(
            (
                received -
                total
            ) * 100
        ) / 100;


    changeLabel.textContent =
        "Vuelto: $" +
        formatMoney(change);

    changeLabel.className =
        "payment-change-result valid";

    confirmButton.disabled =
        false;

    return true;

}


function updatePaymentMethod() {

    const method =
        document.getElementById(
            "payment-method"
        ).value;

    const cashBox =
        document.getElementById(
            "cash-payment-box"
        );

    const confirmButton =
        document.getElementById(
            "confirm-sale-btn"
        );


    if (method === "efectivo") {

        cashBox.style.display =
            "block";

        calculateChange();

    } else {

        cashBox.style.display =
            "none";

        confirmButton.disabled =
            false;

    }

}


function confirmSale() {

    if (cart.length === 0) {

        closeModal(
            "payment-modal"
        );

        return;

    }

    const total =
        getCartTotal();

    const paymentMethod =
        document.getElementById(
            "payment-method"
        ).value;


    let cashReceived = null;
    let cashChange = null;


    if (
        paymentMethod ===
        "efectivo"
    ) {

        if (!calculateChange()) {

            alert(
                "El monto recibido es menor al total de la venta."
            );

            return;

        }

        cashReceived =
            Number(
                document.getElementById(
                    "cash-received"
                ).value
            );

        cashChange =
            Math.round(
                (
                    cashReceived -
                    total
                ) * 100
            ) / 100;

    }


    const sale = {

        id: Date.now(),

        date:
            new Date().toISOString(),

        status: "realizada",

        paymentMethod:
            paymentMethod,

        cashReceived:
            cashReceived,

        cashChange:
            cashChange,

        items:
            cart.map(item => {

                const product =
                    products.find(
                        p => p.id === item.id
                    );

                const isWeight =
                    item.saleType === "weight"
                    ||
                    (
                        product
                        &&
                        product.saleType === "weight"
                    );


                if (isWeight) {

                    const weight =
                        Number(
                            item.weight ??
                            item.quantity ??
                            0
                        );

                    const priceUnit =
                        Number(
                            item.priceUnit ??
                            product?.priceUnit ??
                            1000
                        );

                    return {

                        id: item.id,

                        code: item.code,

                        name: item.name,

                        price: item.price,

                        saleType: "weight",

                        priceUnit:
                            priceUnit,

                        weight: weight,

                        quantity: weight,

                        subtotal:
                            weight *
                            Number(item.price) /
                            priceUnit

                    };

                }


                return {

                    id: item.id,

                    code: item.code,

                    name: item.name,

                    price: item.price,

                    saleType: "unit",

                    quantity: item.quantity,

                    subtotal:
                        Number(item.price) *
                        Number(item.quantity)

                };

            }),

        total: total

    };


    sales.push(sale);

    saveSales();

    cart = [];

    saveCart();

    updateCartUI();

    renderCatalog(
        getFilteredProducts()
    );

    closeModal(
        "payment-modal"
    );

    cashBillHistory = [];

    alert(
        "¡Venta registrada correctamente!"
    );

}


/* =========================================================
   ANULAR VENTA
========================================================= */

function cancelSale(id) {

    const sale =
        sales.find(
            s => s.id === id
        );

    if (
        !sale
        ||
        sale.status === "anulada"
    ) {
        return;
    }

    if (
        !confirm(
            "¿Anular esta venta y devolver el stock?"
        )
    ) {
        return;
    }

    sale.status =
        "anulada";

    sale.cancelledAt =
        new Date().toISOString();


    sale.items.forEach(item => {

        const product =
            products.find(
                p => p.id === item.id
            );

        if (product) {

            if (
                item.saleType === "weight"
                ||
                product.saleType === "weight"
            ) {

                product.stock +=
                    Number(
                        item.weight ??
                        item.quantity ??
                        0
                    );

            } else {

                product.stock +=
                    Number(item.quantity)
                    || 0;

            }

        }

    });


    saveProducts();
    saveSales();

    renderCatalog(
        getFilteredProducts()
    );

    renderHistory();

}


/* =========================================================
   HISTORIAL
========================================================= */

function openHistory() {

    renderHistory();

    document.getElementById(
        "history-modal"
    ).style.display =
        "flex";

}


function renderHistory() {

    const container =
        document.getElementById(
            "sales-history"
        );

    container.innerHTML = "";


    if (sales.length === 0) {

        container.innerHTML =
            "<p>No hay ventas registradas.</p>";

        return;

    }


    [...sales]
        .reverse()
        .forEach(sale => {

            const div =
                document.createElement(
                    "div"
                );

            div.className =
                "sale";


            const date =
                new Date(
                    sale.date
                ).toLocaleString(
                    "es-AR"
                );


            const payment =
                paymentName(
                    sale.paymentMethod
                );


            const itemsText =
                sale.items
                    .map(item => {

                        if (
                            item.saleType ===
                            "weight"
                        ) {

                            return `
                                ${escapeHTML(
                                    item.name
                                )}
                                ×
                                ${formatWeight(
                                    item.weight
                                )}
                                =
                                $${formatMoney(
                                    item.subtotal
                                )}
                            `;

                        }

                        return `
                            ${escapeHTML(
                                item.name
                            )}
                            ×
                            ${item.quantity}
                            =
                            $${formatMoney(
                                item.subtotal
                            )}
                        `;

                    })
                    .join("<br>");


            let cashText = "";


            if (
                sale.paymentMethod ===
                "efectivo"
                &&
                sale.cashReceived !==
                null
                &&
                sale.cashReceived !==
                undefined
            ) {

                cashText = `

                    <br>

                    <small>
                        Recibido:
                        $${formatMoney(
                            sale.cashReceived
                        )}
                    </small>

                    <br>

                    <small>
                        Vuelto:
                        $${formatMoney(
                            sale.cashChange
                        )}
                    </small>

                `;

            }


            div.innerHTML = `

                <div class="sale-row">

                    <div class="sale-info">

                        <strong>
                            Venta #${sale.id}
                        </strong>

                        <br>

                        <small>
                            ${date}
                        </small>

                        <br><br>

                        ${itemsText}

                        <br><br>

                        <strong>
                            Total:
                            $${formatMoney(
                                sale.total
                            )}
                        </strong>

                        <br>

                        <small>
                            Pago:
                            ${payment}
                        </small>

                        ${cashText}

                    </div>

                    <div>

                        <div
                            class="
                                history-status
                                ${
                                    sale.status ===
                                    "anulada"
                                        ? "cancelled"
                                        : "completed"
                                }
                            "
                        >
                            ${
                                sale.status ===
                                "anulada"
                                    ? "ANULADA"
                                    : "REALIZADA"
                            }
                        </div>

                        ${
                            sale.status !==
                            "anulada"

                                ?

                            `
                                <button
                                    class="btn-remove"
                                    style="margin-top:8px"
                                    onclick="
                                        cancelSale(
                                            ${sale.id}
                                        )
                                    "
                                >
                                    Anular
                                </button>
                            `

                                :

                            ""
                        }

                    </div>

                </div>

            `;

            container.appendChild(div);

        });

}


/* =========================================================
   ADMINISTRACIÓN
========================================================= */

function openAdmin() {

    renderAdmin();

    document.getElementById(
        "admin-modal"
    ).style.display =
        "flex";

}


function renderAdmin() {

    const container =
        document.getElementById(
            "admin-products"
        );

    container.innerHTML = "";


    products.forEach(product => {

        const div =
            document.createElement(
                "div"
            );

        div.className =
            "admin-product";


        let priceText;

        if (
            product.saleType ===
            "weight"
        ) {

            const unit =
                Number(
                    product.priceUnit
                ) === 100
                    ? "100 g"
                    : "1 kg";

            priceText =
                `$${formatMoney(
                    product.price
                )} / ${unit}`;

        } else {

            priceText =
                `$${formatMoney(
                    product.price
                )}`;

        }


        let stockText;

        if (
            product.saleType ===
            "weight"
        ) {

            stockText =
                `${formatWeight(
                    product.stock
                )}`;

        } else {

            stockText =
                `${product.stock}`;

        }


        const typeText =
            product.saleType ===
            "weight"
                ? "Por peso"
                : "Por unidad";


        div.innerHTML = `

            <div class="admin-row">

                <div class="admin-info">

                    <strong>
                        ${escapeHTML(
                            product.name
                        )}
                    </strong>

                    <br>

                    <small>
                        Código:
                        ${escapeHTML(
                            product.code
                        )}
                    </small>

                    <br>

                    <small>
                        Venta:
                        ${typeText}
                    </small>

                    <br>

                    <small>
                        Precio:
                        ${priceText}
                        ·
                        Stock:
                        ${stockText}
                        ${
                            product.saleType ===
                            "weight"
                                ? " g"
                                : ""
                        }
                    </small>

                </div>

                <button
                    class="top-btn"
                    onclick="
                        openEditProduct(
                            ${product.id}
                        )
                    "
                >
                    ✏️
                </button>

            </div>

        `;

        container.appendChild(div);

    });

}


/* =========================================================
   NUEVO PRODUCTO
========================================================= */

function openNewProduct() {

    editingProductId = null;

    document.getElementById(
        "product-modal-title"
    ).textContent =
        "Nuevo producto";

    document.getElementById(
        "product-code"
    ).value = "";

    document.getElementById(
        "product-name"
    ).value = "";

    document.getElementById(
        "product-sale-type"
    ).value =
        "unit";

    document.getElementById(
        "product-price-unit"
    ).value =
        "100";

    document.getElementById(
        "product-price"
    ).value = "";

    document.getElementById(
        "product-stock"
    ).value =
        "0";

    document.getElementById(
        "delete-product-btn"
    ).style.display =
        "none";

    document.getElementById(
        "product-code-status"
    ).textContent = "";

    document.getElementById(
        "product-code-status"
    ).className =
        "code-status";

    toggleWeightOptions();

    document.getElementById(
        "product-modal"
    ).style.display =
        "flex";

}


function openNewProductFromAdmin() {

    closeModal(
        "admin-modal"
    );

    openNewProduct();

}


/* =========================================================
   EDITAR PRODUCTO
========================================================= */

function openEditProduct(id) {

    const product =
        products.find(
            p => p.id === id
        );

    if (!product) return;

    editingProductId =
        id;

    document.getElementById(
        "product-modal-title"
    ).textContent =
        "Editar producto";

    document.getElementById(
        "product-code"
    ).value =
        product.code;

    document.getElementById(
        "product-name"
    ).value =
        product.name;

    document.getElementById(
        "product-sale-type"
    ).value =
        product.saleType ||
        "unit";

    document.getElementById(
        "product-price-unit"
    ).value =
        product.priceUnit ||
        "1000";

    document.getElementById(
        "product-price"
    ).value =
        product.price;

    document.getElementById(
        "product-stock"
    ).value =
        product.stock;

    document.getElementById(
        "delete-product-btn"
    ).style.display =
        "block";

    toggleWeightOptions();

    validateProductCode();

    closeModal(
        "admin-modal"
    );

    document.getElementById(
        "product-modal"
    ).style.display =
        "flex";

}


/* =========================================================
   CONFIGURACIÓN PESO
========================================================= */

function toggleWeightOptions() {

    const saleType =
        document.getElementById(
            "product-sale-type"
        ).value;

    const options =
        document.getElementById(
            "weight-options"
        );

    const stockLabel =
        document.getElementById(
            "stock-label"
        );


    if (saleType === "weight") {

        options.style.display =
            "block";

        stockLabel.textContent =
            "Stock disponible (gramos)";

    } else {

        options.style.display =
            "none";

        stockLabel.textContent =
            "Stock disponible";

    }

}


/* =========================================================
   VALIDACIÓN CÓDIGO
========================================================= */

function validateProductCode() {

    const input =
        document.getElementById(
            "product-code"
        );

    const status =
        document.getElementById(
            "product-code-status"
        );

    const code =
        input.value.trim();

    status.textContent =
        "";

    status.className =
        "code-status";


    if (!code) {
        return false;
    }


    const duplicate =
        products.find(
            p =>
                String(p.code) ===
                String(code)
                &&
                p.id !==
                editingProductId
        );


    if (duplicate) {

        status.textContent =
            "⚠️ Este código ya está registrado.";

        status.classList.add(
            "duplicate"
        );

        return false;

    }


    status.textContent =
        "✅ Código disponible";

    status.classList.add(
        "available"
    );

    return true;

}


/* =========================================================
   GUARDAR PRODUCTO
========================================================= */

function saveProduct() {

    const code =
        document.getElementById(
            "product-code"
        ).value.trim();

    const name =
        document.getElementById(
            "product-name"
        ).value.trim();

    const saleType =
        document.getElementById(
            "product-sale-type"
        ).value;

    const price =
        Number(
            document.getElementById(
                "product-price"
            ).value
        );

    const stock =
        Number(
            document.getElementById(
                "product-stock"
            ).value
        );

    const priceUnit =
        Number(
            document.getElementById(
                "product-price-unit"
            ).value
        );


    if (!code || !name) {

        alert(
            "Completá código y nombre."
        );

        return;

    }


    if (
        price < 0
        ||
        stock < 0
    ) {

        alert(
            "Precio y stock no pueden ser negativos."
        );

        return;

    }


    if (
        saleType === "weight"
        &&
        ![100, 1000].includes(
            priceUnit
        )
    ) {

        alert(
            "Seleccioná si el precio corresponde a 100 g o 1 kg."
        );

        return;

    }


    if (!validateProductCode()) {

        alert(
            "Ya existe un producto con ese código."
        );

        return;

    }


    if (editingProductId === null) {

        const newProduct = {

            id: Date.now(),

            code: code,

            name: name,

            price: price,

            stock: stock,

            saleType: saleType

        };


        if (saleType === "weight") {

            newProduct.priceUnit =
                priceUnit;

        }


        products.push(
            newProduct
        );

    } else {

        const product =
            products.find(
                p =>
                    p.id ===
                    editingProductId
            );

        if (!product) return;


        product.code =
            code;

        product.name =
            name;

        product.price =
            price;

        product.stock =
            stock;

        product.saleType =
            saleType;


        if (saleType === "weight") {

            product.priceUnit =
                priceUnit;

        } else {

            delete product.priceUnit;

        }


        const cartItem =
            cart.find(
                item =>
                    item.id ===
                    product.id
            );


        if (cartItem) {

            cartItem.code =
                code;

            cartItem.name =
                name;

            cartItem.price =
                price;

            cartItem.saleType =
                saleType;


            if (
                saleType ===
                "weight"
            ) {

                cartItem.priceUnit =
                    priceUnit;

            } else {

                delete cartItem.priceUnit;

            }

            saveCart();

        }

    }


    saveProducts();

    closeModal(
        "product-modal"
    );

    renderCatalog(
        getFilteredProducts()
    );

    updateCartUI();

}


/* =========================================================
   ELIMINAR PRODUCTO
========================================================= */

function deleteProduct() {

    if (
        editingProductId ===
        null
    ) {
        return;
    }


    const inCart =
        cart.some(
            item =>
                item.id ===
                editingProductId
        );


    if (inCart) {

        alert(
            "No podés eliminar un producto que está en el carrito."
        );

        return;

    }


    if (
        !confirm(
            "¿Eliminar este producto?"
        )
    ) {
        return;
    }


    products =
        products.filter(
            p =>
                p.id !==
                editingProductId
        );

    saveProducts();

    closeModal(
        "product-modal"
    );

    renderCatalog(
        getFilteredProducts()
    );

}


/* =========================================================
   UTILIDADES
========================================================= */

function closeModal(id) {

    document.getElementById(
        id
    ).style.display =
        "none";

}


function getFilteredProducts() {

    const query =
        document
            .getElementById(
                "search"
            )
            .value
            .toLowerCase()
            .trim();


    if (!query) {
        return products;
    }


    return products.filter(
        product =>

            product.name
                .toLowerCase()
                .includes(query)

            ||

            String(product.code)
                .includes(query)

    );

}


function formatMoney(value) {

    return Number(value)
        .toLocaleString(
            "es-AR",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }
        );

}


function formatWeight(value) {

    return Number(value)
        .toLocaleString(
            "es-AR"
        );

}


function paymentName(method) {

    const names = {

        efectivo: "Efectivo",

        debito: "Débito",

        transferencia: "Transferencia"

    };

    return names[method]
        ||
        method
        ||
        "Sin especificar";

}


function escapeHTML(text) {

    return String(text)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}


/* =========================================================
   CARRITO MÓVIL
========================================================= */

function toggleCart() {

    const cartElement =
        document.getElementById(
            "cart"
        );

    const arrow =
        document.getElementById(
            "cart-arrow"
        );


    cartElement.classList.toggle(
        "expanded"
    );


    arrow.textContent =
        cartElement.classList.contains(
            "expanded"
        )
            ? "⌄"
            : "⌃";

}


/* =========================================================
   INICIO
========================================================= */

renderCatalog(products);

updateCartUI();