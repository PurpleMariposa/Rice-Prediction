from flask import Flask, request, render_template, jsonify
import pandas as pd
import numpy as np
from statsmodels.tsa.seasonal import seasonal_decompose
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.preprocessing.sequence import TimeseriesGenerator
from keras.models import Sequential
from keras.layers import Dense, LSTM
from sklearn.metrics import mean_squared_error, mean_absolute_error
from math import sqrt
import calendar 
import threading
import joblib
import joblib
from tensorflow.keras.models import load_model
import json
from datetime import datetime
import os
import json

app = Flask(__name__)

# Global variable to store progress
progress = 0

# Define a lock to ensure thread-safe access to the progress variable
progress_lock = threading.Lock()

# Define a route for the web interface
@app.route('/', methods=['POST', 'GET'])
def index():
    return render_template('index.html')

# Pricing route
@app.route('/pricing', methods=['POST', 'GET'])
def pricing():
    global progress
    # Path to the single JSON file for all predictions
    json_file_path = 'static/predictions/rice_price_predictions.json'

    # Handle GET request
    if request.method == 'GET':
        # Check and generate historical predictions for 2015-2020 if missing
        predict_historical_prices_2015_2020(json_file_path)  # Generate predictions up to 2020
        return render_template('Pricing.html')

    # Handle POST request
    if request.method == 'POST':
        # Initialize progress
        with progress_lock:
            progress = 10  # Start progress at 10%

        # Retrieve request parameters
        month = int(request.form.get('month'))
        month_name = calendar.month_name[month]
        rice_type = request.form.get('type').lower()
        year = int(request.form.get('year'))

        # Update progress after reading input data
        with progress_lock:
            progress = 20

        # Load or generate prediction data
        try:
            # Attempt to load existing JSON data
            with open(json_file_path, 'r') as f:
                data = json.load(f)
            
            # If predictions for the requested year are missing, generate them
            if str(year) not in data.get(rice_type, {}):
                raise ValueError("Requested year not found in JSON data.")
        except (FileNotFoundError, ValueError, json.JSONDecodeError):
            with progress_lock:
                progress = 50  # Progress before generating predictions
            # Generate predictions up to the year provided in the POST request
            data = predict_rice_prices_to_year(end_year=year)

        # Update progress after loading or generating JSON
        with progress_lock:
            progress = 70

        # Get predictions for the specified rice type
        predictions = data.get(rice_type, {}).get(str(year), [])

        # Find the matching month in the predictions for the specified year
        predicted_price = None
        for entry in predictions:
            if entry['month'] == month_name:
                predicted_price = entry['price']
                break

        # If no match is found, return an error
        if predicted_price is None:
            with progress_lock:
                progress = 100  # Complete progress on error
            return jsonify(error=f"No prediction data available for {month_name} {year}."), 404

        # Update progress before completing
        with progress_lock:
            progress = 90  # Almost complete

        # Final progress completion
        with progress_lock:
            progress = 100  # Fully complete

        print(f'Prediction: {month_name} - {rice_type} - {predicted_price}')

        # Return the predicted price as JSON
        return jsonify(month=month_name, type=rice_type, year=year, price=predicted_price)



# About route
@app.route('/about', methods=['POST', 'GET'])
def about():
    return render_template('About.html')


@app.route('/start-task', methods=['POST'])
def start_task():
    thread = threading.Thread(target=pricing)
    thread.start()
    return jsonify({"status": "Task started"})

@app.route('/progress')
def get_progress():
    global progress
    return jsonify(progress=progress)


# Predicting rice prices from 2015 to the supplied end year
def predict_rice_prices_to_year(end_year):
    start_year = 2015  # Fixed start year
    json_path = 'static/predictions/rice_price_predictions.json'

    # Check if JSON file exists and load it
    if os.path.exists(json_path):
        with open(json_path, 'r') as f:
            try:
                existing_data = json.load(f)
                # Check if the range of years from 2015 to end year already exists
                all_years_present = True
                for year in range(start_year, end_year + 1):
                    if not all(
                        str(year) in existing_data.get(rice_type, {})
                        for rice_type in ['regular', 'premium', 'special', 'well milled']
                    ):
                        all_years_present = False
                        break
                
                # If all years are present, return the existing data
                if all_years_present:
                    print("JSON file already contains data for the specified years. No predictions needed.")
                    return existing_data
            except json.JSONDecodeError:
                print("JSON file is corrupted or empty. Proceeding with predictions...")
    else:
        existing_data = {}

    # Prediction models and paths setup
    rice_types = {
        "regular": {
            "scaler_path": 'static/models/regular_scaler.pkl',
            "model_path": 'static/models/lstm_regular_rice_price_model.h5',
            "data_path": 'static/datasets/reduced_regular_milled_rice.csv'
        },
        "premium": {
            "scaler_path": 'static/models/premium_scaler.pkl',
            "model_path": 'static/models/lstm_premium_rice_price_model.h5',
            "data_path": 'static/datasets/reduced_premium_rice.csv'
        },
        "special": {
            "scaler_path": 'static/models/special_scaler.pkl',
            "model_path": 'static/models/lstm_special_rice_price_model.h5',
            "data_path": 'static/datasets/reduced_special_rice.csv'
        },
        "well milled": {
            "scaler_path": 'static/models/well_milled_scaler.pkl',
            "model_path": 'static/models/lstm_well_milled_rice_price_model.h5',
            "data_path": 'static/datasets/reduced_well_milled_rice.csv'
        }
    }

    all_predictions = existing_data

    for rice_type, paths in rice_types.items():
        # Load scaler, model, and data
        scaler = joblib.load(paths['scaler_path'])
        model = load_model(paths['model_path'], compile=False)
        df = pd.read_csv(paths['data_path'])

        # Prepare and preprocess data
        df['MONTH'] = df['MONTH'].astype(int)
        df["DATE"] = pd.to_datetime(df['YEAR'].astype(str) + '/' + df['MONTH'].astype(str) + '/01')
        df = df.set_index('DATE').asfreq('MS')

        # Ensure both required columns exist
        if "Inflation Rate (%)" not in df.columns:
            last_known_inflation = 2.0  # Example placeholder for inflation rate
            df["Inflation Rate (%)"] = last_known_inflation

        df = df[['Price / kg', 'Inflation Rate (%)']]

        # Scale data
        scaled_train = scaler.transform(df.iloc[:-12])

        # Prepare for predictions
        n_input = 345
        n_features = 2
        last_train_batch = scaled_train[-n_input:]
        current_batch = last_train_batch.reshape((1, n_input, n_features))

        # Predict from 2015 to the end year
        if rice_type not in all_predictions:
            all_predictions[rice_type] = {}

        for year in range(start_year, end_year + 1):
            if str(year) in all_predictions[rice_type]:
                continue  # Skip years already present

            yearly_predictions = []
            for month in range(1, 13):
                # Predict next month's price
                current_pred = model.predict(current_batch)[0, 0]  # Access scalar value
                yearly_predictions.append(current_pred)

                # Update batch with the latest prediction and the most recent inflation rate
                new_feature = np.array([[current_pred, scaled_train[-1, 1]]])  # Stub for inflation
                new_feature = new_feature.reshape((1, 1, n_features))
                current_batch = np.append(current_batch[:, 1:, :], new_feature, axis=1)

            # Inverse transform predictions to get actual prices
            yearly_predictions = np.array(yearly_predictions).reshape(-1, 1)
            inflation_stub = np.full_like(yearly_predictions, scaled_train[-1, 1])  # Stub for inflation
            combined_predictions = np.hstack((yearly_predictions, inflation_stub))
            actual_yearly_predictions = scaler.inverse_transform(combined_predictions)[:, 0]

            # Append predictions for the year
            predicted_prices = [
                {
                    'month': calendar.month_name[month],
                    'year': year,
                    'price': round(float(price), 2)
                }
                for month, price in enumerate(actual_yearly_predictions, start=1)
            ]
            all_predictions[rice_type][str(year)] = predicted_prices

    # Export to JSON file
    with open(json_path, 'w') as f:
        json.dump(all_predictions, f, indent=4)

    print(f"Predictions from {start_year} to {end_year} have been saved to {json_path}")
    return all_predictions


# Path to the JSON file
JSON_FILE_PATH = os.path.join('static', 'predictions', 'rice_price_predictions.json')


# Historical prediction 2015-2020
def predict_historical_prices_2015_2020(json_file_path):
    try:
        # Load existing data
        with open(json_file_path, 'r') as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        # Start with an empty dictionary if the file doesn't exist or is invalid
        data = {}

    # Initialize a set to track existing years across all rice types
    existing_years = set()

    # Extract existing years from the JSON structure
    for rice_type, year_data in data.items():
        if isinstance(year_data, dict):  # Ensure year_data is a dictionary
            existing_years.update(map(int, year_data.keys()))  # Collect all existing years as integers

    # Define the range of historical years
    historical_years = range(2015, 2021)
    missing_years = [year for year in historical_years if year not in existing_years]

    # Define rice types
    rice_types = ['regular', 'premium', 'special', 'well milled']

    # Generate predictions only for missing years
    if missing_years:
        print(f"Generating historical predictions for years: {missing_years}")
        for year in missing_years:
            for rice_type in rice_types:
                if rice_type not in data:
                    data[rice_type] = {}  # Initialize nested dictionary for the rice type

                if str(year) not in data[rice_type]:
                    data[rice_type][str(year)] = []  # Initialize list for the year

                for month in range(1, 13):  # Generate for all months
                    month_name = calendar.month_name[month]
                    predicted_price = round(np.random.uniform(30, 80), 2)  # Example prediction
                    data[rice_type][str(year)].append({
                        'month': month_name,
                        'year': year,
                        'price': predicted_price
                    })

        # Save updated predictions back to the JSON file
        with open(json_file_path, 'w') as f:
            json.dump(data, f, indent=4)
        print(f"Historical predictions for years 2015–2020 have been saved to {json_file_path}.")
    else:
        print("Historical predictions for years 2015–2020 already exist. Skipping generation.")



@app.route('/api/prices')
def get_prices():
    # Load the JSON data
    with open(JSON_FILE_PATH, 'r') as file:
        data = json.load(file)
    return jsonify(data)


@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    end_year = data.get('end_year', datetime.now().year)

    # Call the predict_all_rice_types function with end_year as an argument
    predictions = predict_rice_prices_to_year(end_year)
    return jsonify(predictions), 200


if __name__ == '__main__':
    app.run(debug=True)
