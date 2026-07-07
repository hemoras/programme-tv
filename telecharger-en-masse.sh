#!/bin/bash
#node telecharger-programme.js INA tf1 "2010-05-29->2010-12-31"

# mangas
for annee in $(seq 2006 2025); do
  node telecharger-programme.js INA mangas $annee
done

# equidia
for annee in $(seq 2003 2011); do
  node telecharger-programme.js INA equidia $annee
done

# encyclopedia
for annee in $(seq 2003 2015); do
  node telecharger-programme.js INA encyclopedia $annee
done


# animaux
for annee in $(seq 2003 2025); do
  node telecharger-programme.js INA animaux $annee
done

# escales
for annee in $(seq 2003 2015); do
  node telecharger-programme.js INA escales $annee
done

# ab-moteurs
for annee in $(seq 2003 2018); do
  node telecharger-programme.js INA ab-moteurs $annee
done
