# GNEISS

Linters catch syntax. Nothing catches architecture. GNEISS does.

A CLI tool that parses Java imports into a dependency graph and runs a 
GNN-FiLM pipeline over it to surface structural decay — cyclic 
dependencies, tight coupling, architectural rot — before it becomes 
a rewrite.

<img width="2560" height="1368" alt="Adobe Express - Adobe Express - testdummy - Visual Studio Code 2026-06-18 21-09-15 (1)" src="https://github.com/user-attachments/assets/77b4f3c4-d580-4e49-bd97-b675ad98b1b3" />


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