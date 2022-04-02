import "./toast.less";
const toastContainer = document.createElement("DIV");
document.body.appendChild(toastContainer);
toastContainer.id = "toastContainer";

export function showToast(text, className = "success") {
  const toast = document.createElement("DIV");
  toastContainer.appendChild(toast);
  toast.innerText = text;
  toast.className = className;
  const timeout = setTimeout(clear, 6000);
  toast.addEventListener("click", clear);
  function clear() {
    toastContainer.removeChild(toast);
    clearTimeout(timeout);
  }
}
