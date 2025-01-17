// JavaScript function to toggle menu display
function toggleMenu() {
  const menuContent = document.getElementById("mySidenav");
  menuContent.style.width =
    menuContent.style.width === "250px" ? "0px" : "250px";
}
document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", function () {
    document
      .querySelectorAll(".nav-link")
      .forEach((link) => link.classList.remove("active"));
    this.classList.add("active");
  });
});

// Prediction form
function submitForm() {
  const month = document.getElementById("month").value;
  const type = document.getElementById("rice_type").value;
  const year = document.getElementById("year").value;

  // Use Fetch API to send data to the server
  fetch("/pricing", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      month: month,
      type: type,
      year: year,
    }),
  })
    .then((response) => response.json()) // Expecting JSON response
    .then((data) => {
      showModal(data.month, data.type, data.year, data.price); // Show the data in a modal
    })
    .catch((error) => console.error("Error:", error));
}

function showModal(month, type, year, price) {
  const modal = document.getElementById("pop-up");
  document.getElementById("predicted_month").innerText = month;
  document.getElementById("predicted_type").innerText = type;
  document.getElementById("predicted_year").innerText = year;
  document.getElementById("predicted_price").innerText = price;
  modal.style.display = "block";
}

function closeModal() {
  const modal = document.getElementById("pop-up");
  modal.style.display = "none";
}

// Progress bar script
function startTask() {
  // Show the modal when the task starts
  document.getElementById("progress-modal").style.display = "block";

  // Start the task on the server
  fetch("/start-task", { method: "POST" })
    .then((response) => response.json())
    .then((data) => {
      console.log(data.status);
      updateProgress(); // Begin polling for progress updates
    });
}

function updateProgress() {
  fetch("/progress")
    .then((response) => response.json())
    .then((data) => {
      const progressBar = document.getElementById("progress-bar");
      progressBar.style.width = data.progress + "%";
      progressBar.innerText = data.progress + "%";

      // Continue updating if task not completed
      if (data.progress < 100) {
        setTimeout(updateProgress, 500); // Poll every 500 ms
      } else {
        // Close the modal when the task is complete
        setTimeout(() => {
          document.getElementById("progress-modal").style.display = "none";
        }, 1000); // Delay for 1 second before closing
      }
    });
}

// DOM elements
const inputElement = document.getElementById("year-input");
const chartElement = document
  .getElementById("retail-price-chart")
  .getContext("2d");

// Global chart variable
let chart;

// Fetch predictions JSON data
async function fetchPredictions() {
  try {
    showLoading(); // Show loading before fetching data
    const response = await fetch(
      `/static/predictions/rice_price_predictions.json?timestamp=${new Date().getTime()}`
    );
    if (!response.ok) throw new Error("Failed to load JSON");
    return await response.json();
  } catch (error) {
    console.error("Error fetching predictions:", error);
  } finally {
    hideLoading(); // Hide loading after data is fetched
  }
}

function getYearlyPrices(data, year) {
  const yearlyPrices = {};
  Object.keys(data).forEach((riceType) => {
    if (data[riceType][year]) {
      // Access the data for the given year
      yearlyPrices[riceType] = data[riceType][year].map((item) => ({
        month: item.month,
        price: item.price,
      }));
    } else {
      // Handle missing years gracefully
      yearlyPrices[riceType] = [];
    }
  });
  return yearlyPrices;
}

// Initialize chart with datasets for each rice type
function initializeChart(riceTypes) {
  const colors = {
    regular: "rgba(54, 162, 235, 1)", // Regular
    premium: "rgba(255, 99, 132, 1)", // Premium
    special: "#dcf16f", // Special
    well_milled: "rgba(153, 102, 255, 1)", // Well Milled
  };

  const datasets = riceTypes.map((riceType) => ({
    label: `${
      riceType.charAt(0).toUpperCase() + riceType.slice(1)
    } Price (per kg)`,
    data: [],
    borderColor: colors[riceType.replace(/ /g, "_")],
    backgroundColor: colors[riceType.replace(/ /g, "_")],
    fill: false,
    borderWidth: 2,
    pointRadius: 4,
  }));

  return new Chart(chartElement, {
    type: "line",
    data: { labels: [], datasets },
    options: {
      responsive: true,
      scales: {
        x: {
          title: { display: true, text: "Month" },
          grid: { display: true },
        },
        y: {
          title: { display: true, text: "Price" },
          display: true,
          grid: { display: true },
          ticks: { display: true },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (tooltipItem) {
              const datasetIndex = tooltipItem.datasetIndex;
              const dataIndex = tooltipItem.dataIndex;

              // Get prices for this month across all rice types
              const monthlyPrices = chart.data.datasets.map(
                (dataset) => dataset.data[dataIndex]
              );

              // Sort prices and get the evaluation labels
              const sortedPrices = [...monthlyPrices].sort((a, b) => b - a);
              const evaluationLabels = [
                "VERY GOOD",
                "GOOD",
                "AVERAGE",
                "NOT GOOD",
              ];

              // Find the evaluation label based on the sorted prices
              const price = monthlyPrices[datasetIndex];
              const rank = sortedPrices.indexOf(price);
              const evaluation = evaluationLabels[rank];

              // Return only the evaluation label
              return evaluation;
            },
          },
        },
      },
    },
  });
}

// Update chart with selected year's data and add evaluations
function updateChart(chart, yearlyPrices) {
  const labels = yearlyPrices["regular"].map((item) => item.month);
  chart.data.labels = labels;

  Object.keys(yearlyPrices).forEach((riceType, index) => {
    chart.data.datasets[index].data = yearlyPrices[riceType].map(
      (item) => item.price
    );
  });

  chart.update();
}

// Trigger prediction and chart update
async function triggerPrediction(event) {
  if (event.key === "Enter") {
    const endYear = parseInt(inputElement.value);
    if (!isNaN(endYear) && endYear >= new Date().getFullYear()) {
      showLoading();
      await predictAllRiceTypes(endYear); // Call prediction function
      await updateChartWithYear(endYear); // Update chart with new data
      hideLoading();
    } else {
      alert(
        "Please enter a valid year greater than or equal to the current year."
      );
    }
  }
}

// Update chart with the selected year
async function updateChartWithYear(year) {
  showLoading();
  const data = await fetchPredictions();
  const yearlyPrices = getYearlyPrices(data, year);

  if (Object.keys(yearlyPrices).length === 0) {
    alert("No data available for the selected year.");
  } else {
    updateChart(chart, yearlyPrices);
  }
  hideLoading();
}

// Main setup function
async function setup() {
  const data = await fetchPredictions();
  const riceTypes = Object.keys(data);
  const currentYear = new Date().getFullYear();

  chart = initializeChart(riceTypes);
  updateChartWithYear(currentYear);
}

// Backend API call to predict prices
async function predictAllRiceTypes(endYear) {
  try {
    const response = await fetch("/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ end_year: endYear }),
    });
    if (!response.ok) throw new Error("Prediction failed");

    const data = await response.json();
    console.log("Prediction successful:", data);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Get the loading container element
const loadingContainer = document.getElementById("loading-container");

// Show and hide loading container functions
function showLoading() {
  loadingContainer.style.visibility = "visible";
}

function hideLoading() {
  loadingContainer.style.visibility = "hidden";
}

// Run setup on load
setup();

// FORECAST CHART
let myChart1, myChart2;
const uniqueYearsChart2 = new Set();
const riceDataChart2 = {
  premium: [],
  regular: [],
  special: [],
  "well milled": [],
};

// Global variable to store the maximum year in the data
let maxYearInData = 2015; // Default minimum year

// Fetch data for chart2 and chart3 from local JSON
async function getJSONDataForChart2AndChart3(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const jsonData = await response.json();

    Object.keys(jsonData).forEach((type) => {
      Object.keys(jsonData[type]).forEach((year) => {
        jsonData[type][year].forEach((entry) => {
          const { month, year, price } = entry;

          // Format year-month label
          const monthIndex = new Date(`${month} 1, ${year}`).getMonth() + 1;
          const label = `${year}-${monthIndex < 10 ? "0" : ""}${monthIndex}`;

          const key = type === "wellMilled" ? "well milled" : type; // Map wellMilled to "well milled"
          riceDataChart2[key].push({ year, month: monthIndex, price, label });
          uniqueYearsChart2.add(parseInt(year));
        });
      });
    });

    // Determine the maximum year
    maxYearInData = Math.max(...uniqueYearsChart2);

    console.log("Max year in data:", maxYearInData);
    console.log("Parsed data for Chart 2 & 3:", riceDataChart2);
  } catch (error) {
    console.error("Error fetching JSON data:", error);
  }
}

// Populate year dropdowns for chart2 and chart3
function populateYearDropdownsChart2() {
  const startYearSelect = document.getElementById("startYear");
  const endYearSelect = document.getElementById("endYear");

  const yearsArray = Array.from(uniqueYearsChart2)
    .filter((year) => year >= 2015 && year <= maxYearInData)
    .sort((a, b) => a - b);

  // Clear any existing options in the dropdowns
  startYearSelect.innerHTML = "";
  endYearSelect.innerHTML = "";

  yearsArray.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;

    // Append options to both dropdowns
    startYearSelect.appendChild(option.cloneNode(true));
    endYearSelect.appendChild(option);
  });

  // Set default values to the full range
  startYearSelect.value = " ";
  endYearSelect.value = " ";
}

// Update chart2 and chart3
function updateChart2AndChart3() {
  let startYear = parseInt(document.getElementById("startYear").value);
  let endYear = parseInt(document.getElementById("endYear").value);

  // Ensure the selected years are within the valid range
  if (startYear < 2015) startYear = 2015;
  if (endYear > maxYearInData) endYear = maxYearInData;

  const filteredData2 = {
    labels: [],
    datasets: [],
  };

  const datasetColors2 = {
    premium: {
      backgroundColor: "rgba(255, 99, 132, 0)",
      borderColor: "rgba(255, 99, 132, 1)",
      borderWidth: 2,
    },
    regular: {
      backgroundColor: "rgba(54, 162, 235, 0)",
      borderColor: "rgba(54, 162, 235, 1)",
      borderWidth: 2,
    },
    special: {
      backgroundColor: "rgba(220, 241, 111, 0)",
      borderColor: "rgba(220, 241, 111, 1)",
      borderWidth: 2,
    },
    "well milled": {
      backgroundColor: "rgba(153, 102, 255, 0)",
      borderColor: "rgba(153, 102, 255, 1)",
      borderWidth: 2,
    },
  };

  Object.keys(riceDataChart2).forEach((type) => {
    const filteredPrices = riceDataChart2[type].filter((item) => {
      const year = parseInt(item.year);
      return year >= startYear && year <= endYear;
    });

    if (filteredPrices.length > 0) {
      filteredData2.labels = filteredPrices.map((item) => item.label);
      filteredData2.datasets.push({
        label: `${type.charAt(0).toUpperCase() + type.slice(1)} Rice Prices`,
        data: filteredPrices.map((item) => item.price),
        ...datasetColors2[type],
      });
    }
  });

  if (myChart2) {
    myChart2.destroy();
  }

  const config2 = {
    type: "line",
    data: filteredData2,
    options: {
      layout: {
        padding: {
          bottom: 59,
        },
      },
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: false,
            text: "Year-Month",
          },
        },
        y: {
          beginAtZero: false,
          title: {
            display: true,
            text: "Price",
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
      },
    },
  };

  myChart2 = new Chart(document.getElementById("line-chart2"), config2);
}

// Initialize charts
async function setupChart2AndChart3() {
  await getJSONDataForChart2AndChart3(
    "/static/predictions/rice_price_predictions.json"
  );

  populateYearDropdownsChart2();
  updateChart2AndChart3();
}

// Event Listeners
document
  .getElementById("startYear")
  .addEventListener("change", updateChart2AndChart3);
document
  .getElementById("endYear")
  .addEventListener("change", updateChart2AndChart3);

// Initialize setup
setupChart2AndChart3();
