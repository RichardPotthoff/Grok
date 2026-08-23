
function render({ model, el }) {
    const btn = document.createElement("button");
    btn.textContent = model.get("description");

    // Pre-defined change event
    model.on("change:description", () => {
        btn.textContent = model.get("description");
    });

    // Pre-defined custom message event (for clicks)
    btn.addEventListener("click", () => {
        alert("Button was clicked!");
        alert(model.send.length);
        model.send({ event: "click" });
    });

    // Listen for custom messages sent FROM Python
    model.on("msg:custom", (msg, buffers) => {
        console.log("Received custom msg from Python:", msg);
        if (msg.type === "alert") alert(msg.text);
    });

    el.appendChild(btn);
}

export default {render};