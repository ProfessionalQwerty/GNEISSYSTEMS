# GNEISS

Linters catch syntax. Nothing catches architecture. GNEISS does.

A CLI tool that parses Java imports into a dependency graph and runs a 
GNN-FiLM pipeline over it to surface structural decay — cyclic 
dependencies, tight coupling, architectural rot — before it becomes 
a rewrite.



<img width="800" height="272" alt="repos_cache-VisualStudioCode2026-06-1809-37-00-ezgif com-video-to-gif-converter" src="https://github.com/user-attachments/assets/8a0e52d4-bfd8-4ba3-b5a2-fcf2dfe936dc" />





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
