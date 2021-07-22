const express = require('express');
const app = express();
const router = express.Router();
const serverless = require('serverless-http');
const fetch = require('node-fetch').default;
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();


app.use(cors({
  origin: '*'
}));

const headers = {
  "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
  "Authorization": "Basic " + Buffer.from(process.env.USERNAME + ":" + process.env.PERSONAL_ACCESS_TOKEN).toString('base64')
}


router.get('/', async (req, res) => {
  const order = req.query.order || "desc";
  const lang = req.query.lang ? req.query.lang.toLowerCase() : "scala";
  const perc = req.query.perc || 100;
  const page = req.query.page || 1;
  let url = `https://api.github.com/search/issues?q=label:%22good%20first%20issue%22+language:${lang}+state:open&sort=created&order=${order}&per_page=10&page=${page}`
  const response = await fetch(url, { method: 'GET', headers: headers })
  const resultsJson = await response.json()
  const goodFirstIssueData = resultsJson.items

  const languagePercentagesPromises = goodFirstIssueData.map(async item => {
    let langResponse = await fetch(item.repository_url + "/languages", { method: 'GET', headers: headers })
    let languages = await langResponse.json()
    let sum = Object.values(languages).reduce((acc, val) => acc + val, 0)

    // Transform language bytes in percentages
    Object.keys(languages).forEach(key => languages[key] = (languages[key] / sum) * 100)
    return languages
  })

  const repoDetailsPromises = goodFirstIssueData.map(async item => {
    let repoDetailsResponse = await fetch(item.repository_url, { method: 'GET', headers: headers })
    let details = await repoDetailsResponse.json()
    return ({ full_name: details.full_name, description: details.description, stargazers_count: details.stargazers_count, pushed_at: details.pushed_at })
  })

  const [languagePercentages, repoDetails] = await Promise.all([
    Promise.all(languagePercentagesPromises),
    Promise.all(repoDetailsPromises)
  ])

  // Add languages and their percentages to data from github
  let goodFirstIssueDataWithLang = goodFirstIssueData.map((repo, index) => {
    repo["languages"] = languagePercentages[index]
    return repo
  })

  // Add repo details to data from github
  goodFirstIssueDataWithLang = goodFirstIssueDataWithLang.map((repo, index) => {
    repo["repo_details"] = repoDetails[index]
    return repo
  })

  const filteredLangIndex = languagePercentages.map(item => Object.values(item)[Object.keys(item).map(k => k.toLowerCase()).indexOf(lang)]).reduce((arr, percent, index) => {
    if (percent >= perc) arr.push(index);
    return arr;
  }, []);
  const filteredRepo = goodFirstIssueDataWithLang.filter((repo, index) => filteredLangIndex.includes(index))



  res.json(filteredRepo)




})

app.use('/.netlify/functions/app', router);

module.exports.handler = serverless(app);