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

// CHART AND ITS CONFIGURATIONS
let myChart1, myChart2;
const uniqueYears = new Set();
const riceData = {
  premium: [],
  regular: [],
  special: [],
  wellMilled: [],
};

// Function to get data from a given URL
async function getData(url, type) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const dataset = await response.text();
    const data = dataset.split("\n");

    let lastValidPrice = null;

    data.forEach((row, index) => {
      if (index === 0) return; // Skip header

      const col = row.split(",");
      if (col.length > 14) {
        // Ensure there are enough columns
        const year = col[1].trim(); // YEAR is in the first column
        const month = parseInt(col[2].trim()); // MONTH is in the second column
        let price = parseFloat(col[3].trim()); // Price / kg is in the third column

        const label = `${year}-${month < 10 ? "0" : ""}${month}`; // Format year-month label

        // If price is 0.00, replace it with the last valid price
        if (price === 0) {
          price = lastValidPrice;
        } else {
          lastValidPrice = price; // Update last valid price
        }

        // Store data for chart
        riceData[type].push({ year, month, price, label });
        uniqueYears.add(year);
      }
    });

    console.log(`Parsed data for ${type}:`, riceData[type]);
  } catch (error) {
    console.error("There has been a problem with your fetch operation:", error);
  }
}

setupChart();

async function setupChart() {
  await getData(
    "https://raw.githubusercontent.com/PurpleMariposa/Rice-Prediction/refs/heads/main/static/datasets/reduced_premium_rice.csv",
    "premium"
  );
  await getData(
    "https://raw.githubusercontent.com/PurpleMariposa/Rice-Prediction/refs/heads/main/static/datasets/reduced_regular_milled_rice.csv",
    "regular"
  );
  await getData(
    "https://raw.githubusercontent.com/PurpleMariposa/Rice-Prediction/refs/heads/main/static/datasets/reduced_special_rice.csv",
    "special"
  );
  await getData(
    "https://raw.githubusercontent.com/PurpleMariposa/Rice-Prediction/refs/heads/main/static/datasets/reduced_well_milled_rice.csv",
    "wellMilled"
  );

  populateYearDropdowns();
  updateChart();
}

// Populate year dropdowns
function populateYearDropdowns() {
  const startYearSelect = document.getElementById("startYear");
  const endYearSelect = document.getElementById("endYear");

  const yearsArray = Array.from(uniqueYears).sort();

  yearsArray.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    startYearSelect.appendChild(option.cloneNode(true)); // Add to start year dropdown
    endYearSelect.appendChild(option); // Add to end year dropdown
  });

  // Set the latest year as the default value for the end year dropdown
  endYearSelect.value = yearsArray[yearsArray.length - 1];
}

// Update chart based on selected years
function updateChart() {
  const startYear = parseInt(document.getElementById("startYear").value);
  const endYear = parseInt(document.getElementById("endYear").value);

  const filteredData1 = {
    labels: [],
    datasets: [],
  };

  const filteredData2 = {
    labels: [],
    datasets: [],
  };

  const datasetColors1 = {
    premium: {
      backgroundColor: "rgba(255, 99, 132, 0)",
      borderColor: "rgba(255, 99, 132, 1)",
      borderWidth: 1,
    },
    regular: {
      backgroundColor: "rgba(54, 162, 235, 0)",
      borderWidth: 1,
      borderColor: "rgba(54, 162, 235, 1)",
    },
    special: {
      backgroundColor: "rgba(75, 192, 192, 0)",
      borderWidth: 1,
      borderColor: "rgba(75, 192, 192, 1)",
    },
    wellMilled: {
      backgroundColor: "rgba(153, 102, 255, 0)",
      borderWidth: 1,
      borderColor: "rgba(153, 102, 255, 1)",
    },
  };
  const datasetColors2 = {
    premium: {
      backgroundColor: "rgba(255, 99, 132, 0.2)",
      borderColor: "rgba(255, 99, 132, 1)",
      borderWidth: 2,
    },
    regular: {
      backgroundColor: "rgba(54, 162, 235, 0.2)",
      borderWidth: 2,
      borderColor: "rgba(54, 162, 235, 1)",
    },
    special: {
      backgroundColor: "#dcf16f",
      borderWidth: 2,
      borderColor: "#dcf16f",
    },
    wellMilled: {
      backgroundColor: "rgba(153, 102, 255, 0.2)",
      borderWidth: 2,
      borderColor: "rgba(153, 102, 255, 1)",
    },
  };

  // Clear previous data
  filteredData1.labels = [];
  filteredData1.datasets = [];
  filteredData2.labels = [];
  filteredData2.datasets = [];

  Object.keys(riceData).forEach((type) => {
    const prices1 = riceData[type].filter((item) => {
      const year = parseInt(item.year);
      return year >= startYear && year <= endYear;
    });

    if (prices1.length > 0) {
      filteredData1.labels = prices1.map((item) => item.label); // Now use the 'label' (year-month)
      filteredData1.datasets.push({
        label: `${type.charAt(0).toUpperCase() + type.slice(1)} Rice Prices`,
        data: prices1.map((item) => item.price),
        ...datasetColors1[type],
        borderWidth: 0,
      });
    }

    const prices2 = riceData[type].filter((item) => {
      const year = parseInt(item.year);
      return year >= startYear && year <= endYear;
    });

    if (prices2.length > 0) {
      filteredData2.labels = prices2.map((item) => item.label); // Now use the 'label' (year-month)
      filteredData2.datasets.push({
        label: `${type.charAt(0).toUpperCase() + type.slice(1)} Rice Prices`,
        data: prices2.map((item) => item.price),
        ...datasetColors2[type],
        borderWidth: 2,
      });
    }
  });

  if (myChart1) {
    myChart1.destroy();
  }
  if (myChart2) {
    myChart2.destroy();
  }

  // Config for the chart1
  const config1 = {
    type: "line",
    data: filteredData1,
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
          ticks: {
            display: true,
          },
          grid: {
            drawTicks: false,
          },
          beginAtZero: false,
          title: {
            display: true,
            text: "Price",
          },

          afterFit: (ctx) => {
            ctx.width = 40;
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: false,
        },
      },
    },
  };

  // Config for the chart2
  const config2 = {
    type: "line",
    data: filteredData2,
    options: {
      layout: {
        padding: {
          bottom: 40,
          top: 10,
        },
      },
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: {
            display: true,
          },
          grid: {
            drawTicks: false,
          },
          title: {
            display: false,
            text: "Year-Month",
          },
        },
        y: {
          ticks: {
            display: false,
          },
          grid: {
            drawTicks: false,
          },
          beginAtZero: true,
          title: {
            display: false,
            text: "Price",
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: function (tooltipItem) {
              const datasetIndex = tooltipItem.datasetIndex;
              const price = tooltipItem.raw;
              return `${Object.keys(riceData)[datasetIndex]} Rice: ${price}`;
            },
          },
        },
      },
    },
  };

  // Render the charts
  myChart1 = new Chart(document.getElementById("line-chart1"), config1);
  myChart2 = new Chart(document.getElementById("line-chart2"), config2);
}

// Add event listeners for dropdowns
document.getElementById("startYear").addEventListener("change", updateChart);
document.getElementById("endYear").addEventListener("change", updateChart);

// Call the setup function to fetch data and render the chart
setupChart();

// Instantly assign Chart.js version
const chartVersion = document.getElementById("chartVersion");
// CHART ENDS

async function updateRicePrices() {
  try {
    const response = await fetch("/api/prices");
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const ricePrices = await response.json();
    console.log("Fetched rice prices:", ricePrices);

    const currentDate = new Date();
    const currentMonth = currentDate.toLocaleString("default", {
      month: "long",
    });
    const currentYear = currentDate.getFullYear();

    // Mapping rice types to their respective display IDs
    const riceTypes = {
      regular: "regular-price",
      premium: "premium-price",
      "well milled": "well-milled-price", // Corrected the key here
      special: "special-price",
    };

    for (const type in riceTypes) {
      const priceSectionId = riceTypes[type];
      const yearlyPrices = ricePrices[type]; // Prices are now nested by year
      console.log(`Prices for ${type}:`, yearlyPrices);

      // Check if the specific year exists in the data
      if (yearlyPrices && yearlyPrices[currentYear]) {
        const prices = yearlyPrices[currentYear]; // Get the array of prices for the current year

        // Check if prices is defined and is an array
        if (Array.isArray(prices)) {
          const priceData = prices.find(
            (price) =>
              price.month === currentMonth && price.year === currentYear
          );

          if (priceData) {
            const priceDisplay = document
              .getElementById(priceSectionId)
              .querySelector(".price-display");
            priceDisplay.innerHTML = `<span class="peso-sign">&#8369;</span> ${priceData.price.toFixed(
              2
            )}/kg`;
          } else {
            console.warn(
              `No price data found for ${type} in ${currentMonth} ${currentYear}`
            );
            const priceDisplay = document
              .getElementById(priceSectionId)
              .querySelector(".price-display");
            priceDisplay.innerHTML = `<span class="peso-sign">&#8369;</span> Not available`;
          }
        } else {
          console.error(
            `Expected prices to be an array for ${type}, but got:`,
            prices
          );
          const priceDisplay = document
            .getElementById(priceSectionId)
            .querySelector(".price-display");
          priceDisplay.innerHTML = `<span class="peso-sign">&#8369;</span> Not available`;
        }
      } else {
        console.warn(`No price data found for ${type} in ${currentYear}`);
        const priceDisplay = document
          .getElementById(priceSectionId)
          .querySelector(".price-display");
        priceDisplay.innerHTML = `<span class="peso-sign">&#8369;</span> Not available`;
      }
    }
  } catch (error) {
    console.error("Error fetching rice prices:", error);
  }
}

// Call the function to update prices on page load
window.onload = updateRicePrices;
