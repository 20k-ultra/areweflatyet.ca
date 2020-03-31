 Are we flat yet ? [areweflatyet.ca](https://areweflatyet.ca)
==================================
> We are apart but not alone.

This project attempts to convey how Canada is doing at flattening the curve for infections of SARS-COV-2.

I specifically made this project to help people with anxiety to be able to stay informed on the situation but not be exposed to the overwhelming stats and news reports. This project is intended to err on optimism. It purposely only uses positive language and only includes links to uplifting news.

### **Where is the data from ?**

The data used can be found in the [Current Situtation](https://www.canada.ca/en/public-health/services/diseases/2019-novel-coronavirus-infection.html#a1) section from the Canadian Governments website for COVID-19 stats in Canada.

### **How is the result calculated?**

The updater will start at present day and compare total confirmed cases to the previous day.

For example:

```sh
# The data to compare
30-03-2020 confirmed cases: 1706
29-03-2020 confirmed cases: 1355

# Plot the data
x1 = 0
y1 = log(1706) // 3.231979027
x2 = 1
y2 = log(993) // 2.996949248

# Deltas
dy = y2 - y1 // 0.235029779
dx = x2 - x1 // 1

# Thetas
t = thetas(dy, dx)

# Convert to degrees
angle = t * 180 / Pi
```

These angles are calculated for 10 days, each time moving the start one day older. These angles were then averaged. I did this because taking a single angle was really sensitive to just 1 angle so averaging over a 10 day spread provided a more consistent angle.

### **How does it work ?**

This project consists of a single html template and css file. The template file is used by the [updater](updater.js) script to create a current report.

I went with this approach so I could have the updater execute in a Lambda function then store the report in S3.

You can generate a report by running:

```sh
npm run generate
```

The generated html is stored inside an index.html file.

### **To Do:**
 - [x] Compute how canada is doing
 - [x] Show how each province is doing
 - [ ] Automate Uplifting News section
 - [ ] Add tests
 - [ ] Add disclaimer next to which provinces are under testing

### **Special Thanks**

The site's style and layout was taken from [areweasyncyet.rs](https://areweasyncyet.rs/).