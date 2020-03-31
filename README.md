 Are we flat yet ? [areweflatyet.ca](https://areweflatyet.ca)
==================================
> We are apart but not alone.

This project attempts to convey how Canada is doing at flattening the curve for infections of SARS-COV-2.

I specifically made this project to help people with anxiety to be able to stay informed on the situation but not be exposed to the overwhelming stats and news reports. This project is intended to err on optimism. It purposely only uses positive language and only includes links to uplifting news.

### **Where is the data from ?**

The data used can be found in the [Current Situtation](https://www.canada.ca/en/public-health/services/diseases/2019-novel-coronavirus-infection.html#a1) section from the Canadian Governments website for COVID-19 stats in Canada.

### **How is the result calculated?**

It uses a logarithmic function to compare previous data and given the range a result is outputted. The possible results are:
 - not yet
 - getting there
 - it's working
 - almost there
 - yes!

Once I actually implement this I'll expand on it more...

### **How does it work ?**

This project consists of a single html template and css file. The template file is used by the [updater](updater.js) script to create a current report.

I went with this approach so I could have the updater execute in a Lambda function then store the report in S3.

You can generate a report by running:

```sh
npm run generate
```

The generated html is stored inside an index.html file.

### **To Do:**
 - [ ] Compute how canada is doing
 - [ ] Show how each province is doing
 - [ ] Automate Uplifting News section
 - [ ] Add tests
 - [ ] Add disclaimer next to which provinces are under testing

### ** Special Thanks**

The site's style and layout was taken from [areweasyncyet.rs](https://areweasyncyet.rs/).