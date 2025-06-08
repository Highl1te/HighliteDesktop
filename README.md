<p><img src="https://github.com/user-attachments/assets/da5bb809-3949-4854-99e4-1619022444e7" width="128"/></p>
<p>
  <a href="https://discord.gg/SszbKF5dtm"><img alt="JoinDiscord" src="https://img.shields.io/badge/Discord-Join_Us-purple?style=flat&logo=Discord&label=Discord"/></a>
  <img alt="GitHub License" src="https://img.shields.io/github/license/Highl1te/HighliteDesktop">
  <img alt="Build Status" src="https://img.shields.io/github/actions/workflow/status/Highl1te/HighliteDesktop/main.yml"> 
  <img alt="Downloads" src="https://img.shields.io/github/downloads/Highl1te/HighliteDesktop/latest/total?label=Downloads&color=blue">
</p>

# HighLite
HighLite is an open-source game client for High Spell and has received permission to operate from the game developer (Dew).

# Installing HighLite
HighLite is packaged as an Electron application and provides [Linux](#Linux), [MacOS](#MacOS), and [Windows](#Windows) support.

## Windows
1. Obtain the .exe file from the [latest release](https://github.com/Highl1te/HighliteDesktop/releases/latest)
> [!WARNING]
> In Microsoft Edge, you may recieve a download warning due to HighLite not being commonly downloaded.
> 
> ![image](https://github.com/user-attachments/assets/8dd15f93-29c4-42a8-966b-1bd8a83fa66c)
> 
> You can typically resolve this by clicking '...' and selecting 'Keep'


> [!WARNING]
> HighLite is currently un-signed due to the inherent cost of obtaining signing certificates for software. This results in install and download warnings.
> If we recieve enough players (or complaints!) we will invest in obtaining certificates.
> 
> ![image](https://github.com/user-attachments/assets/90651443-a7ed-42b1-8e60-60af2a54fbf1)
>
> You can resolve this by clicking 'More Info' and pressing 'Run anyway'
> 
> ![image](https://github.com/user-attachments/assets/f1537d49-7aac-4344-ba6a-77a01339e63f)
> 

3. Install HighLite
4. You will be prompted by the game client when launching to automatically install any future updates!
## Linux
1. Obtain the .AppImage file from the [latest release](https://github.com/Highl1te/HighliteDesktop/releases/latest)
2. Execute the AppImage
3. You will be prompted by the game client when launching to automatically install any future updates!
## MacOS
> [!CAUTION]
> MacOS builds go largely untested so they may be more prone to buggy behavior.

1. Instructions Pending





# Related Repositories
HighLite is split into two repositories [HighliteDesktop](https://github.com/Highl1te/HighliteDesktop) and [Core](https://github.com/Highl1te/Core).

 - `HighliteDesktop` handles pulling in the `Core` and the `High Spell Web Client` and providing a cross-platform execution space.
 - `Core` handles interactions from HighLite to the `High Spell Web Client`.

# Development
## Software Requirements
- NodeJS v22 LTS (https://nodejs.org/en/download)
- Yarn (npm install --global corepack)

## Building
### Non-Package Build
`yarn start`
### Package Build
`yarn app:dist`
