var p = location.pathname.slice(0, 60);
document.getElementById("path").textContent = p;
document.querySelector(".perf").textContent = "| status=404 path=" + p;
