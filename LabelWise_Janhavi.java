/*
Janhavi Joshi
Team 2 - LabelWise

This module implments:
UC04: View detailed breakdown of ingredient analysis results
UCO9: View previously scanned safe items
*/

import java.util.*;

class Product {
 String name;
 String status;
 List<String> allIngredients;
 List<String> flaggedIngredients;

 public Product(String name, String status, List<String> allIngredients, List<String> flaggedIngredients) {
  this.name = name;
  this.status = status;
  this.allIngredients = allIngredients;
  this.flaggedIngredients = flaggedIngredients;
 }
}

public class LabelWise_Janhavi{
/*
UCO4: View detailed breakdown of ingredient analysis results
Displays all ingredients and highlights those that are flagged.
*/
public void viewIngredientAnalysis(Product product) {
 System.out.println("=== LabelWise - Ingredient Analysis ===");
 System.out.println("Product Name: " + product.name);
 System.out.println("Safety Status: " + product.status);
 System.out.println("\nAll Ingredients:");

 for (String ingredient : product.allIngredients) {
    System.out.print("- " + ingredient);
 }
 if (!product.flaggedIngredients.isEmpty()) {
    System.out.println("\n\nFlagged Ingredients (Restricted):");
    for (String flagged : product.flaggedIngredients) {
        System.out.println("- " + flagged + "(may violate dietary restrictions)");
    }
} else {
   System.out.println("\n\nNo flagged ingredients. This product is safe for consumption based on the analysis." );
  }
 }

/*
* UC09: View previously scanned safe items
* Displays products that were previously analyzed and deemed safe.
*/

public void viewSafeScanHistory(List<Product> scanHistory) {
 System.out.println("=== LabelWise - Safe Product History ===");
 boolean hasSafeProducts = false;
 for (Product product : scanHistory) {
      if (product.status.equals("Safe")) {
         hasSafeProducts = true;
         System.out.println("- " + product.name);
      }
   }
   if (!hasSafeProducts) {
      System.out.println("No safe products found in history.");
   }
}

public static void main(String[] args) {
 LabelWise_Janhavi janhaPart = new LabelWise_Janhavi();

 // Sample Data
 List<String> ingredient1 = List.of("Milk", "Sugar", "Cocoa Butter", "Soy Lecithin");
 List<String> flagged1 = List.of("Soy"); // Soy is flagged for this user

 List<String> ingredient2 = List.of("Oats", "Honey", "Almonds");
 List<String> flagged2 = new ArrayList<>(); // No flagged ingredients
 
 Product chocolate = new Product("Chocolate Bar", "Unsafe", ingredient1, flagged1);
 Product granola = new Product("Granola Mix", "Safe", ingredient2, flagged2);

 // View ingredient analysis for a product
 janhaPart.viewIngredientAnalysis(chocolate);

 // Sample scan history with one safe and one unsafe product
 List<Product> scanHistory = new ArrayList<>();
 scanHistory.add(granola); // Safe product
 scanHistory.add(new Product("Sugary Cereal", "Unsafe", List.of("Corn", "Sugar"), List.of("Sugar"))); // Unsafe product

 // View previously scanned safe items
 janhaPart.viewSafeScanHistory(scanHistory);
}
}

