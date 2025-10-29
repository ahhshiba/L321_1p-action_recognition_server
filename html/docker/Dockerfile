FROM node:22.12

ARG VITE_STREAM_URL=""
ARG VITE_API_BASE_URL=""

ENV VITE_STREAM_URL=${VITE_STREAM_URL}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["npm", "run", "serve"]
