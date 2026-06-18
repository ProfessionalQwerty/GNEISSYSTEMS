# GNEISS

Linters catch syntax. Nothing catches architecture. GNEISS does.

A CLI tool that parses Java imports into a dependency graph and runs a 
GNN-FiLM pipeline over it to surface structural decay — cyclic 
dependencies, tight coupling, architectural rot — before it becomes 
a rewrite.

<img width="1814" height="618" alt="Adobe Express - repos_cache-VisualStudioCode2026-06-1809-37-00-ezgif com-video-to-gif-converter" src="https://github.com/user-attachments/assets/e59cff07-c1aa-476e-a685-63828aef93d3" />

## Installation

# Windows
irm https://raw.githubusercontent.com/ProfessionalQwerty/GNEISSYSTEMS/main/install.ps1 | iex

# Mac
curl -fsSL https://raw.githubusercontent.com/ProfessionalQwerty/GNEISSYSTEMS/main/install.sh | bash

## Usage

gneiss auth        # authenticate via GitHub
gneiss audit ./src # scan a Java project

## License
MIT
